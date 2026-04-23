/**
 * Recovery Service
 *
 * Generates, stores, and validates one-time recovery codes.
 * Codes are encrypted with the user's master key and stored in Firestore
 * at users/{uid}/recoveryCodes/{codeId}.
 */

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { encrypt, decrypt } from "../crypto/encryption";
import { RecoveryCode } from "../types";

const RECOVERY_CODE_COUNT = 8;
const CODE_LENGTH = 8;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function recoveryCollection(userId: string) {
  return collection(db, "users", userId, "recoveryCodes");
}

/**
 * Ensures code is always uppercase and stripped of any separators like spaces or dashes.
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Generate a single random recovery code string.
 */
function generateCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(values)
    .map((v) => CODE_CHARS[v % CODE_CHARS.length])
    .join("");
}

/**
 * Generate a SHA-256 hash of the normalized code to use as a Firestore lookup key.
 * This is fast and prevents slow iteration through all recovery slots.
 */
async function hashCode(normalizedCode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedCode);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate recovery codes, encrypt the master password with each code,
 * and store in Firestore.
 * Returns the plaintext codes for the user to save.
 */
export async function generateRecoveryCodes(
  userId: string,
  plaintextMasterPassword: string
): Promise<string[]> {
  // Delete existing codes first
  const existing = await getDocs(recoveryCollection(userId));
  const deletePromises = existing.docs.map((d) =>
    deleteDoc(doc(db, "users", userId, "recoveryCodes", d.id))
  );
  await Promise.all(deletePromises);

  const codes: string[] = [];
  const now = Timestamp.now();

  // Import key derivation once since it requires WebCrypto
  // We'll dynamically import so we don't cause circular dependencies
  const { importMasterPassword } = await import("../crypto/keyDerivation");

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateCode();
    codes.push(code);

    // Derive a temporary key from this specific Recovery Code
    // using the same PBKDF2 logic we use for Master Passwords
    const recoveryKeyMaterial = await importMasterPassword(normalizeCode(code));

    // Encrypt the *actual* Master Password using the Recovery Key
    const encrypted = await encrypt(plaintextMasterPassword, recoveryKeyMaterial);
    
    // Compute the hash for fast lookup
    const codeHash = await hashCode(normalizeCode(code));

    await addDoc(recoveryCollection(userId), {
      encryptedPassword: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      codeHash, // Added for O(1) lookup
      used: false,
      createdAt: now,
    });
  }

  return codes;
}

/**
 * Check if the user has any recovery codes.
 */
export async function hasRecoveryCodes(userId: string): Promise<boolean> {
  const snapshot = await getDocs(recoveryCollection(userId));
  return snapshot.docs.length > 0;
}

/**
 * Get all recovery codes (encrypted) to display status.
 */
export async function getRecoveryCodes(userId: string): Promise<RecoveryCode[]> {
  const q = query(recoveryCollection(userId), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as RecoveryCode[];
}

/**
 * Validate a recovery code against stored encrypted Master Passwords.
 * If valid, marks it as used and returns the decrypted Master Password string.
 */
export async function validateRecoveryCode(
  userId: string,
  code: string
): Promise<string | null> {
  const { importMasterPassword } = await import("../crypto/keyDerivation");
  
  // Normalize the user's input before derivation
  const normalized = normalizeCode(code);
  const codeHash = await hashCode(normalized);

  // Fast Lookup: Find the specific document by hash AND ensure it's not used
  const q = query(
    recoveryCollection(userId),
    where("codeHash", "==", codeHash),
    where("used", "==", false)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null; // Code not found or already used
  }

  const stored = snapshot.docs[0].data() as RecoveryCode;
  const recoveryKeyMaterial = await importMasterPassword(normalized);

  try {
    // Attempt to decrypt back the Master Password
    const decryptedPassword = await decrypt(
      {
        ciphertext: stored.encryptedPassword,
        iv: stored.iv,
        salt: stored.salt,
      },
      recoveryKeyMaterial
    );

    // If successful, mark as used
    const codeRef = doc(db, "users", userId, "recoveryCodes", snapshot.docs[0].id);
    await updateDoc(codeRef, { used: true });
    
    return decryptedPassword;
  } catch {
    // This should technically NOT happen if the hash matched, but we handle it
    return null;
  }
}
