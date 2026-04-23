import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { decrypt, encrypt } from "../crypto/encryption";
import { getPasswords, getPasswordSamples, VAULT_METADATA_DOC_ID } from "./passwordService";
import { getSettings, updateSettings } from "./settingsService";
import { EncryptedPayload } from "../types";

const VAULT_VERIFIER = "mypass:vault-verifier:v1";
const VAULT_METADATA_SERVICE_NAME = "__mypass_vault_meta__";

interface VaultMetadata {
  verificationCiphertext: string;
  verificationIv: string;
  verificationSalt: string;
  version: number;
  serviceName: string;
  username: string;
  url: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function vaultMetadataDoc(userId: string) {
  return doc(db, "users", userId, "passwords", VAULT_METADATA_DOC_ID);
}

function toEncryptedPayload(metadata: VaultMetadata): EncryptedPayload {
  return {
    ciphertext: metadata.verificationCiphertext,
    iv: metadata.verificationIv,
    salt: metadata.verificationSalt,
  };
}

export async function hasVaultVerifier(userId: string): Promise<boolean> {
  const snapshot = await getDoc(vaultMetadataDoc(userId));
  return snapshot.exists();
}

export async function needsMasterPasswordSetup(userId: string): Promise<boolean> {
  if (await hasVaultVerifier(userId)) {
    return false;
  }

  const samples = await getPasswordSamples(userId, 1);
  return samples.length === 0;
}

async function createVaultVerifier(
  userId: string,
  masterKey: CryptoKey
): Promise<void> {
  const encrypted = await encrypt(VAULT_VERIFIER, masterKey);
  const now = Timestamp.now();

  await setDoc(vaultMetadataDoc(userId), {
    verificationCiphertext: encrypted.ciphertext,
    verificationIv: encrypted.iv,
    verificationSalt: encrypted.salt,
    version: 1,
    serviceName: VAULT_METADATA_SERVICE_NAME,
    username: "",
    url: "",
    createdAt: now,
    updatedAt: now,
  } satisfies VaultMetadata);
}

async function verifyVaultVerifier(
  userId: string,
  masterKey: CryptoKey
): Promise<boolean> {
  const snapshot = await getDoc(vaultMetadataDoc(userId));
  if (!snapshot.exists()) {
    return false;
  }

  const metadata = snapshot.data() as VaultMetadata;
  const plaintext = await decrypt(toEncryptedPayload(metadata), masterKey);
  return plaintext === VAULT_VERIFIER;
}

async function verifyLegacyVault(userId: string, masterKey: CryptoKey) {
  const samples = await getPasswordSamples(userId, 5);
  if (samples.length === 0) {
    return false;
  }

  for (const sample of samples) {
    try {
      await decrypt(
        {
          ciphertext: sample.encryptedData,
          iv: sample.iv,
          salt: sample.salt,
        },
        masterKey
      );
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function unlockVault(userId: string, masterKey: CryptoKey) {
  if (await hasVaultVerifier(userId)) {
    const verified = await verifyVaultVerifier(userId, masterKey);
    if (!verified) {
      throw new Error("Incorrect master password.");
    }
    return;
  }

  const isFirstUnlock = await needsMasterPasswordSetup(userId);
  if (isFirstUnlock) {
    await createVaultVerifier(userId, masterKey);
    return;
  }

  const legacyVerified = await verifyLegacyVault(userId, masterKey);
  if (!legacyVerified) {
    throw new Error("Incorrect master password.");
  }

  await createVaultVerifier(userId, masterKey);
}

/**
 * Change the master password by re-encrypting all vault entries.
 *
 * Steps:
 * 1. Decrypt each password entry with oldKey
 * 2. Re-encrypt with newKey
 * 3. Update Firestore document
 * 4. Re-create the vault verifier with newKey
 */
export async function changeMasterPassword(
  userId: string,
  oldKey: CryptoKey,
  newKey: CryptoKey
): Promise<void> {
  const passwords = await getPasswords(userId);

  for (const entry of passwords) {
    // Decrypt with old key
    const plaintext = await decrypt(
      {
        ciphertext: entry.encryptedData,
        iv: entry.iv,
        salt: entry.salt,
      },
      oldKey
    );

    // Re-encrypt with new key
    const newEncrypted = await encrypt(plaintext, newKey);

    // Update in Firestore
    const entryRef = doc(db, "users", userId, "passwords", entry.id!);
    await updateDoc(entryRef, {
      encryptedData: newEncrypted.ciphertext,
      iv: newEncrypted.iv,
      salt: newEncrypted.salt,
      updatedAt: Timestamp.now(),
    });
  }

  // 3. Re-encrypt TOTP secret in settings if enabled
  try {
    const settingsSnapshot = await getSettings(userId);
    if (settingsSnapshot.totpEnabled && settingsSnapshot.totpSecret) {
      try {
        // Decrypt with oldKey
        const secret = await decrypt(settingsSnapshot.totpSecret, oldKey);
        // Re-encrypt with newKey
        const newSecret = await encrypt(secret, newKey);
        // Update settings
        await updateSettings(userId, { totpSecret: newSecret });
      } catch (err) {
        // CRITICAL SAFE-FAIL: If we cannot re-encrypt the 2FA secret (e.g. it was already broken),
        // we MUST disable 2FA so the user is not permanently locked out.
        console.error("Failed to re-encrypt TOTP secret. Disabling 2FA for safety:", err);
        await updateSettings(userId, { totpEnabled: false, totpSecret: null });
      }
    }
  } catch (err) {
    console.error("Failed to process TOTP settings during master password change:", err);
  }

  // 4. Re-create vault verifier with new key (Last step before cleanup)
  await createVaultVerifier(userId, newKey);

  // 5. Cleanup: Delete existing recovery codes as they now encrypt the old master password and are invalid
  try {
    const recoverySnapshot = await getDocs(
      collection(db, "users", userId, "recoveryCodes")
    );
    for (const codeDoc of recoverySnapshot.docs) {
      await deleteDoc(doc(db, "users", userId, "recoveryCodes", codeDoc.id));
    }
  } catch (err) {
    console.error("Failed to delete outdated recovery codes:", err);
  }
}
