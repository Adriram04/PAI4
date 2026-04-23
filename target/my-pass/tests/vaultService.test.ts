import {
  changeMasterPassword,
  hasVaultVerifier,
  needsMasterPasswordSetup,
  unlockVault,
} from "../src/services/vaultService";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { decrypt, encrypt } from "../src/crypto/encryption";
import { getPasswords, getPasswordSamples } from "../src/services/passwordService";
import { getSettings, updateSettings } from "../src/services/settingsService";

jest.mock("../src/config/firebase", () => ({
  db: { name: "mock-firestore" },
}));

jest.mock("../src/crypto/encryption", () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

jest.mock("../src/services/passwordService", () => ({
  VAULT_METADATA_DOC_ID: "vault-meta",
  getPasswords: jest.fn(),
  getPasswordSamples: jest.fn(),
}));

jest.mock("../src/services/settingsService", () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((...segments: unknown[]) => ({
    type: "doc",
    path: segments.slice(1).join("/"),
  })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ type: "timestamp", value: "now" })),
  },
  collection: jest.fn((...segments: unknown[]) => ({
    type: "collection",
    path: segments.slice(1).join("/"),
  })),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

const oldKey = { id: "old-key" } as unknown as CryptoKey;
const newKey = { id: "new-key" } as unknown as CryptoKey;

const encryptedPayload = {
  ciphertext: "cipher",
  iv: "iv",
  salt: "salt",
};

function metadataSnapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

describe("VaultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(encrypt).mockImplementation(async (plaintext: string) => ({
      ciphertext: `encrypted:${plaintext}`,
      iv: "iv",
      salt: "salt",
    }));
  });

  test("hasVaultVerifier reports whether the metadata document exists", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(metadataSnapshot(true) as never);

    await expect(hasVaultVerifier("user-1")).resolves.toBe(true);

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "passwords",
      "vault-meta"
    );
  });

  test("needsMasterPasswordSetup is false when a verifier already exists", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(metadataSnapshot(true) as never);

    await expect(needsMasterPasswordSetup("user-1")).resolves.toBe(false);
    expect(getPasswordSamples).not.toHaveBeenCalled();
  });

  test("needsMasterPasswordSetup checks legacy samples when no verifier exists", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(metadataSnapshot(false) as never);
    jest.mocked(getPasswordSamples).mockResolvedValueOnce([]);

    await expect(needsMasterPasswordSetup("user-1")).resolves.toBe(true);

    jest.mocked(getDoc).mockResolvedValueOnce(metadataSnapshot(false) as never);
    jest.mocked(getPasswordSamples).mockResolvedValueOnce([
      { id: "password-1" },
    ] as never);

    await expect(needsMasterPasswordSetup("user-1")).resolves.toBe(false);
  });

  test("unlockVault accepts a valid verifier", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(metadataSnapshot(true) as never)
      .mockResolvedValueOnce(
        metadataSnapshot(true, {
          verificationCiphertext: "cipher",
          verificationIv: "iv",
          verificationSalt: "salt",
        }) as never
      );
    jest.mocked(decrypt).mockResolvedValueOnce("mypass:vault-verifier:v1");

    await expect(unlockVault("user-1", oldKey)).resolves.toBeUndefined();
    expect(setDoc).not.toHaveBeenCalled();
  });

  test("unlockVault rejects an invalid verifier", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(metadataSnapshot(true) as never)
      .mockResolvedValueOnce(
        metadataSnapshot(true, {
          verificationCiphertext: "cipher",
          verificationIv: "iv",
          verificationSalt: "salt",
        }) as never
      );
    jest.mocked(decrypt).mockResolvedValueOnce("wrong");

    await expect(unlockVault("user-1", oldKey)).rejects.toThrow(
      "Incorrect master password."
    );
  });

  test("unlockVault creates a verifier for first-time empty vaults", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(metadataSnapshot(false) as never)
      .mockResolvedValueOnce(metadataSnapshot(false) as never);
    jest.mocked(getPasswordSamples).mockResolvedValueOnce([]);

    await unlockVault("user-1", oldKey);

    expect(encrypt).toHaveBeenCalledWith("mypass:vault-verifier:v1", oldKey);
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/vault-meta" },
      expect.objectContaining({
        verificationCiphertext: "encrypted:mypass:vault-verifier:v1",
        serviceName: "__mypass_vault_meta__",
        version: 1,
      })
    );
  });

  test("unlockVault migrates a legacy vault after decrypting a sample", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(metadataSnapshot(false) as never)
      .mockResolvedValueOnce(metadataSnapshot(false) as never);
    jest
      .mocked(getPasswordSamples)
      .mockResolvedValueOnce([{ id: "password-1" }] as never)
      .mockResolvedValueOnce([
        {
          id: "password-1",
          encryptedData: "legacy-cipher",
          iv: "legacy-iv",
          salt: "legacy-salt",
        },
      ] as never);
    jest.mocked(decrypt).mockResolvedValueOnce("legacy plaintext");

    await unlockVault("user-1", oldKey);

    expect(decrypt).toHaveBeenCalledWith(
      {
        ciphertext: "legacy-cipher",
        iv: "legacy-iv",
        salt: "legacy-salt",
      },
      oldKey
    );
    expect(setDoc).toHaveBeenCalled();
  });

  test("unlockVault rejects legacy vaults when no sample decrypts", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(metadataSnapshot(false) as never)
      .mockResolvedValueOnce(metadataSnapshot(false) as never);
    jest
      .mocked(getPasswordSamples)
      .mockResolvedValueOnce([{ id: "password-1" }] as never)
      .mockResolvedValueOnce([
        {
          id: "password-1",
          encryptedData: "legacy-cipher",
          iv: "legacy-iv",
          salt: "legacy-salt",
        },
      ] as never);
    jest.mocked(decrypt).mockRejectedValueOnce(new Error("bad key"));

    await expect(unlockVault("user-1", oldKey)).rejects.toThrow(
      "Incorrect master password."
    );
    expect(setDoc).not.toHaveBeenCalled();
  });

  test("changeMasterPassword re-encrypts entries, TOTP secret, verifier, and deletes recovery codes", async () => {
    jest.mocked(getPasswords).mockResolvedValueOnce([
      {
        id: "password-1",
        encryptedData: "cipher-1",
        iv: "iv-1",
        salt: "salt-1",
      },
      {
        id: "password-2",
        encryptedData: "cipher-2",
        iv: "iv-2",
        salt: "salt-2",
      },
    ] as never);
    jest
      .mocked(decrypt)
      .mockResolvedValueOnce("plain-1")
      .mockResolvedValueOnce("plain-2")
      .mockResolvedValueOnce("totp-secret");
    jest.mocked(getSettings).mockResolvedValueOnce({
      language: "en",
      sessionTimeoutMinutes: 15,
      defaultCategory: "other",
      totpEnabled: true,
      totpSecret: encryptedPayload,
    });
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: "recovery-1" }, { id: "recovery-2" }],
    } as never);

    await changeMasterPassword("user-1", oldKey, newKey);

    expect(updateDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/password-1" },
      expect.objectContaining({
        encryptedData: "encrypted:plain-1",
        iv: "iv",
        salt: "salt",
      })
    );
    expect(updateDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/password-2" },
      expect.objectContaining({
        encryptedData: "encrypted:plain-2",
      })
    );
    expect(updateSettings).toHaveBeenCalledWith("user-1", {
      totpSecret: {
        ciphertext: "encrypted:totp-secret",
        iv: "iv",
        salt: "salt",
      },
    });
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/vault-meta" },
      expect.objectContaining({
        verificationCiphertext: "encrypted:mypass:vault-verifier:v1",
      })
    );
    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "recoveryCodes"
    );
    expect(deleteDoc).toHaveBeenCalledWith({
      type: "doc",
      path: "users/user-1/recoveryCodes/recovery-1",
    });
    expect(deleteDoc).toHaveBeenCalledWith({
      type: "doc",
      path: "users/user-1/recoveryCodes/recovery-2",
    });
  });

  test("changeMasterPassword disables TOTP when secret re-encryption fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    jest.mocked(getPasswords).mockResolvedValueOnce([]);
    jest.mocked(getSettings).mockResolvedValueOnce({
      language: "en",
      sessionTimeoutMinutes: 15,
      defaultCategory: "other",
      totpEnabled: true,
      totpSecret: encryptedPayload,
    });
    jest.mocked(decrypt).mockRejectedValueOnce(new Error("broken secret"));
    jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);

    await changeMasterPassword("user-1", oldKey, newKey);

    expect(updateSettings).toHaveBeenCalledWith("user-1", {
      totpEnabled: false,
      totpSecret: null,
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
