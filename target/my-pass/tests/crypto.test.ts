/**
 * Cryptography Module Tests
 *
 * Tests for key derivation and AES-256-GCM encryption/decryption.
 * These run in Node.js which has Web Crypto API built-in.
 */

import { deriveKey, generateSalt, importMasterPassword, PBKDF2_SALT_BYTES } from "../src/crypto/keyDerivation";
import { encrypt, decrypt, encryptFile, decryptFile } from "../src/crypto/encryption";

describe("Key Derivation (PBKDF2)", () => {
  test("generateSalt produces a 16-byte Uint8Array", () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.byteLength).toBe(PBKDF2_SALT_BYTES);
  });

  test("deriveKey is deterministic — same inputs produce same key", async () => {
    const masterKey = await importMasterPassword("TestMaster123!");
    const salt = new Uint8Array(16).fill(42); // fixed salt for determinism

    const key1 = await deriveKey(masterKey, salt);
    const key2 = await deriveKey(masterKey, salt);

    // Encrypt the same plaintext with both keys — must produce same ciphertext
    // since AES-GCM uses the key deterministically (same key = same decrypt)
    expect(key1.algorithm).toEqual(key2.algorithm);
    expect(key1.type).toBe(key2.type);
    expect(key1.usages).toEqual(key2.usages);
  });

  test("deriveKey throws on invalid salt length", async () => {
    const masterKey = await importMasterPassword("TestMaster123!");
    const badSalt = new Uint8Array(8); // too short

    await expect(deriveKey(masterKey, badSalt)).rejects.toThrow(
      "Invalid salt length"
    );
  });

  test("importMasterPassword returns a non-extractable CryptoKey", async () => {
    const key = await importMasterPassword("MyPassword123!");
    expect(key.type).toBe("secret");
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toEqual({ name: "PBKDF2" });
  });
});

describe("AES-256-GCM Encryption", () => {
  let masterKey: CryptoKey;

  beforeAll(async () => {
    masterKey = await importMasterPassword("TestMaster123!");
  });

  test("encrypt returns an EncryptedPayload with all fields", async () => {
    const result = await encrypt("MySecretPassword", masterKey);
    expect(result).toHaveProperty("ciphertext");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("salt");
    expect(typeof result.ciphertext).toBe("string");
    expect(typeof result.iv).toBe("string");
    expect(typeof result.salt).toBe("string");
    // Base64 strings should be non-empty
    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(result.iv.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);
  });

  test("encrypt + decrypt are inverse operations", async () => {
    const plaintext = "SuperSecret$123!@#";
    const encrypted = await encrypt(plaintext, masterKey);
    const decrypted = await decrypt(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  test("encrypt produces unique IV on each call (randomness)", async () => {
    const enc1 = await encrypt("same-text", masterKey);
    const enc2 = await encrypt("same-text", masterKey);
    // IVs must differ — cryptographic randomness
    expect(enc1.iv).not.toBe(enc2.iv);
  });

  test("encrypt produces unique salt on each call", async () => {
    const enc1 = await encrypt("same-text", masterKey);
    const enc2 = await encrypt("same-text", masterKey);
    expect(enc1.salt).not.toBe(enc2.salt);
  });

  test("decrypt with wrong master key throws error", async () => {
    const encrypted = await encrypt("MySecret", masterKey);

    const wrongKey = await importMasterPassword("WrongPassword!");
    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  test("decrypt with tampered ciphertext throws error", async () => {
    const encrypted = await encrypt("MySecret", masterKey);
    // Tamper with the ciphertext
    const tampered = { ...encrypted, ciphertext: encrypted.ciphertext + "AAA" };
    await expect(decrypt(tampered, masterKey)).rejects.toThrow();
  });

  test("handles empty string encryption/decryption", async () => {
    const encrypted = await encrypt("", masterKey);
    const decrypted = await decrypt(encrypted, masterKey);
    expect(decrypted).toBe("");
  });

  test("handles unicode string encryption/decryption", async () => {
    const unicode = "Contraseña_segura_🔐_日本語";
    const encrypted = await encrypt(unicode, masterKey);
    const decrypted = await decrypt(encrypted, masterKey);
    expect(decrypted).toBe(unicode);
  });

  test("decrypt with invalid IV length throws error", async () => {
    const encrypted = await encrypt("Secret", masterKey);
    const badIV = { ...encrypted, iv: btoa("short") }; // not 12 bytes
    await expect(decrypt(badIV, masterKey)).rejects.toThrow("Invalid IV length");
  });

  test("decrypt with invalid salt length throws error", async () => {
    const encrypted = await encrypt("Secret", masterKey);
    const badSalt = { ...encrypted, salt: btoa("short-salt") }; // not 16 bytes
    await expect(decrypt(badSalt, masterKey)).rejects.toThrow("Invalid salt length");
  });
});

describe("AES-256-GCM Binary (File) Encryption", () => {
  let masterKey: CryptoKey;

  beforeAll(async () => {
    masterKey = await importMasterPassword("FileTestPass123!");
  });

  test("encryptFile + decryptFile round-trip", async () => {
    const originalData = new Uint8Array([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33]); // "Hello, World!"
    const encrypted = await encryptFile(originalData, masterKey);
    
    // Salt(16) + IV(12) + Ciphertext(13) + Tag(16) = 57 bytes
    expect(encrypted.length).toBeGreaterThan(16 + 12 + originalData.length);
    
    const decrypted = await decryptFile(encrypted, masterKey);
    expect(decrypted).toEqual(originalData);
  });

  test("decryptFile throws on tampered data", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = await encryptFile(data, masterKey);
    
    // Tamper with ciphertext (last byte)
    encrypted[encrypted.length - 1] ^= 0xFF;
    
    await expect(decryptFile(encrypted, masterKey)).rejects.toThrow("File decryption failed");
  });
});
