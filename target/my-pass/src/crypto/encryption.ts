/**
 * AES-256-GCM Encryption Module
 *
 * Encrypts and decrypts passwords using AES-256-GCM via the Web Crypto API.
 *
 * Security properties of AES-GCM:
 * - Authenticated encryption (confidentiality + integrity)
 * - 12-byte IV (recommended by NIST SP 800-38D)
 * - 128-bit authentication tag (built-in)
 *
 * Data flow:
 *   Encrypt: plaintext + key → ciphertext + IV + salt (all base64-encoded)
 *   Decrypt: ciphertext + IV + salt + masterPassword → plaintext
 */

import { EncryptedPayload } from "../types";
import {
  deriveKey,
  generateSalt,
  PBKDF2_SALT_BYTES,
} from "./keyDerivation";

const AES_GCM_IV_BYTES = 12;

/**
 * Convert a Uint8Array to a base64 string.
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a plaintext password using AES-256-GCM.
 *
 * A fresh salt and IV are generated for each encryption to ensure
 * that the same plaintext encrypted twice produces different ciphertext.
 *
 * @param plaintext - The password to encrypt
 * @param masterPassword - The user's master password (used to derive the key)
 * @returns EncryptedPayload containing base64-encoded ciphertext, IV, and salt
 */
export async function encrypt(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedPayload> {
  // Generate fresh cryptographic parameters
  const salt = generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));

  // Derive the encryption key from the master password
  const key = await deriveKey(masterKey, salt);

  // Encrypt the plaintext
  const encoder = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(new Uint8Array(ciphertextBuffer)),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  };
}

/**
 * Decrypt an encrypted password using AES-256-GCM.
 *
 * @param encryptedPayload - The encrypted data (ciphertext, IV, salt as base64)
 * @param masterPassword - The user's master password
 * @returns The decrypted plaintext password
 * @throws Error if decryption fails (wrong master password or tampered data)
 */
export async function decrypt(
  encryptedPayload: EncryptedPayload,
  masterKey: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encryptedPayload.ciphertext);
  const iv = base64ToArrayBuffer(encryptedPayload.iv);
  const salt = base64ToArrayBuffer(encryptedPayload.salt);

  if (iv.byteLength !== AES_GCM_IV_BYTES) {
    throw new Error(`Invalid IV length. Expected ${AES_GCM_IV_BYTES} bytes.`);
  }

  if (salt.byteLength !== PBKDF2_SALT_BYTES) {
    throw new Error(
      `Invalid salt length. Expected ${PBKDF2_SALT_BYTES} bytes.`
    );
  }

  // Re-derive the same key from the master password and stored salt
  const key = await deriveKey(masterKey, salt);

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch {
    throw new Error(
      "Decryption failed. This usually means the master password is incorrect."
    );
  }
}

/**
 * Encrypt raw binary data (e.g., a file attachment) using AES-256-GCM.
 * Returns a single Uint8Array: [salt (16 bytes) | iv (12 bytes) | ciphertext].
 */
export async function encryptFile(
  data: Uint8Array,
  masterKey: CryptoKey
): Promise<Uint8Array> {
  const salt = generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const key = await deriveKey(masterKey, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const result = new Uint8Array(salt.length + iv.length + ciphertext.length);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(ciphertext, salt.length + iv.length);
  return result;
}

/**
 * Decrypt raw binary data previously encrypted with encryptFile().
 * Expects the format: [salt (16 bytes) | iv (12 bytes) | ciphertext].
 */
export async function decryptFile(
  encryptedData: Uint8Array,
  masterKey: CryptoKey
): Promise<Uint8Array> {
  const salt = encryptedData.slice(0, PBKDF2_SALT_BYTES);
  const iv = encryptedData.slice(PBKDF2_SALT_BYTES, PBKDF2_SALT_BYTES + AES_GCM_IV_BYTES);
  const ciphertext = encryptedData.slice(PBKDF2_SALT_BYTES + AES_GCM_IV_BYTES);

  const key = await deriveKey(masterKey, salt);

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return new Uint8Array(plaintextBuffer);
  } catch {
    throw new Error("File decryption failed.");
  }
}
