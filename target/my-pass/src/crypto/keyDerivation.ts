/**
 * Key Derivation Module
 *
 * Uses PBKDF2 (via Web Crypto API) to derive a cryptographic key
 * from the user's master password.
 *
 * Security parameters:
 * - Algorithm: PBKDF2
 * - Hash: SHA-256
 * - Iterations: 600,000 (OWASP 2023 recommendation)
 * - Key length: 256 bits (for AES-256-GCM)
 * - Salt: 16 bytes of cryptographically random data
 */

export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_SALT_BYTES = 16;

/**
 * Generate a cryptographically random salt.
 * @returns 16-byte Uint8Array salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
}

/**
 * Import the user's master password once as non-extractable PBKDF2 key material.
 */
export async function importMasterPassword(
  masterPassword: string
): Promise<CryptoKey> {
  const normalizedPassword = masterPassword.normalize("NFKC");
  const encoder = new TextEncoder();

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(normalizedPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
}

/**
 * Derive an AES-256-GCM key from a master password using PBKDF2.
 *
 * @param masterPassword - The user's master password (plaintext, never stored)
 * @param salt - A 16-byte salt (unique per encryption operation)
 * @returns A non-exportable CryptoKey suitable for AES-256-GCM
 */
export async function deriveKey(
  masterKeyMaterial: CryptoKey,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (salt.byteLength !== PBKDF2_SALT_BYTES) {
    throw new Error(`Invalid salt length. Expected ${PBKDF2_SALT_BYTES} bytes.`);
  }

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    masterKeyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // non-exportable — prevents extraction from memory
    ["encrypt", "decrypt"]
  );

  return derivedKey;
}
