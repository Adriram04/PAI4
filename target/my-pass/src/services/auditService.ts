/**
 * Vault Security Audit Service
 *
 * Provides functions to analyze the security health of the user's vault.
 * Includes password strength estimation, reuse detection, age tracking,
 * and integration with Have I Been Pwned (HIBP) via k-anonymity.
 */

import { PasswordEntry, VaultHealthReport, AuditIssue } from "../types";
import { decrypt } from "../crypto/encryption";
import { estimateStrength } from "../utils/passwordGenerator";
import { Timestamp } from "firebase/firestore";

/**
 * Calculates a SHA-1 hash of a string and returns it as a hex string.
 * Uses a basic JS implementation to ensure compatibility across Web and React Native
 * without requiring extra native modules or polyfills for crypto.subtle.
 */
async function sha1(str: string): Promise<string> {
  // Simple SHA-1 implementation for JS compatibility
  const blockArray: number[] = [];
  for (let i = 0; i < str.length; i++) {
    blockArray.push(str.charCodeAt(i));
  }
  
  // Use a simple hex conversion for now or a lightweight helper
  // For production reliability in Expo, we'll use a robust buffer-to-hex pattern
  const utf8 = unescape(encodeURIComponent(str));
  const n = utf8.length;
  const words = new Uint32Array((n + 8 >> 6) + 1 << 4);
  for (let i = 0; i < n; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << 24 - (i & 3) * 8;
  }
  words[n >> 2] |= 0x80 << 24 - (n & 3) * 8;
  words[words.length - 1] = n * 8;

  const res = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const w = new Uint32Array(80);

  for (let i = 0; i < words.length; i += 16) {
    const old = new Uint32Array(res);
    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = words[i + j];
      else w[j] = (w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]) << 1 | (w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]) >>> 31;
      
      const t = (res[0] << 5 | res[0] >>> 27) + res[4] + w[j] + (
        j < 20 ? (res[1] & res[2] | ~res[1] & res[3]) + 0x5a827999 :
        j < 40 ? (res[1] ^ res[2] ^ res[3]) + 0x6ed9eba1 :
        j < 60 ? (res[1] & res[2] | res[1] & res[3] | res[2] & res[3]) - 0x70e44324 :
        (res[1] ^ res[2] ^ res[3]) - 0x359d3e2a
      );
      res[4] = res[3]; res[3] = res[2]; res[2] = res[1] << 30 | res[1] >>> 2; res[1] = res[0]; res[0] = t;
    }
    for (let j = 0; j < 5; j++) res[j] += old[j];
  }

  const hex = Array.from(res).map(x => x.toString(16).padStart(8, '0')).join('');
  return hex.toUpperCase();
}

/**
 * Checks if a password has been seen in public data breaches using HIBP.
 * Uses k-anonymity (range-based search) for privacy.
 *
 * @param password The plaintext password to check.
 * @returns The number of times the password has been breached, or 0 if safe.
 */
export async function checkBreached(password: string): Promise<number> {
  try {
    const fullHash = await sha1(password);
    const prefix = fullHash.substring(0, 5);
    const suffix = fullHash.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return 0;

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix === suffix) {
        return parseInt(count, 10);
      }
    }
  } catch (err) {
    console.error("HIBP check failed:", err);
  }
  return 0;
}

/**
 * Generates a comprehensive health report for a list of password entries.
 * Note: Performs decryption on all entries, which is computationally expensive.
 */
export async function generateHealthReport(
  entries: PasswordEntry[],
  masterKey: CryptoKey,
  onProgress?: (processed: number, total: number) => void
): Promise<VaultHealthReport> {
  const issues: AuditIssue[] = [];
  const now = new Date();
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // Track reused passwords: plaintext -> [ids]
  const plaintextToIds: Record<string, string[]> = {};
  // Decrypted cache: id -> { plaintext, entry }
  const decrypted: Record<string, { plaintext: string; entry: PasswordEntry }> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const plaintext = await decrypt(
        {
          ciphertext: entry.encryptedData,
          iv: entry.iv,
          salt: entry.salt,
        },
        masterKey
      );

      decrypted[entry.id!] = { plaintext, entry };

      // Strength check
      const strength = estimateStrength(plaintext);
      if (strength.score < 3) {
        issues.push({
          passwordId: entry.id!,
          type: "weak",
          serviceName: entry.serviceName,
          username: entry.username,
        });
      }

      // Track for reuse check
      if (!plaintextToIds[plaintext]) {
        plaintextToIds[plaintext] = [];
      }
      plaintextToIds[plaintext].push(entry.id!);

      // Age check
      const updatedAt = entry.updatedAt.toDate();
      if (now.getTime() - updatedAt.getTime() > ONE_YEAR_MS) {
        issues.push({
          passwordId: entry.id!,
          type: "old",
          serviceName: entry.serviceName,
          username: entry.username,
        });
      }

      // HIBP check (Sequential as requested)
      const breachCount = await checkBreached(plaintext);
      if (breachCount > 0) {
        issues.push({
          passwordId: entry.id!,
          type: "breached",
          serviceName: entry.serviceName,
          username: entry.username,
          breachCount,
        });
      }
    } catch (err) {
      console.error(`Audit failed for entry ${entry.id}:`, err);
    }

    if (onProgress) onProgress(i + 1, entries.length);
  }

  // Finalize reuse issues
  for (const ids of Object.values(plaintextToIds)) {
    if (ids.length > 1) {
      for (const id of ids) {
        const info = decrypted[id];
        issues.push({
          passwordId: id,
          type: "reused",
          serviceName: info.entry.serviceName,
          username: info.entry.username,
          reusedWith: ids.filter((otherId) => otherId !== id),
        });
      }
    }
  }

  const compromisedCount = issues.filter((iss) => iss.type === "breached").length;
  const weakCount = issues.filter((iss) => iss.type === "weak").length;
  const reusedCount = issues.filter((iss) => iss.type === "reused").length;
  const oldCount = issues.filter((iss) => iss.type === "old").length;

  return {
    score: calculateSecurityScore(entries.length, {
      breached: compromisedCount,
      weak: weakCount,
      reused: reusedCount,
      old: oldCount,
    }),
    totalPasswords: entries.length,
    compromisedCount,
    weakCount,
    reusedCount,
    oldCount,
    issues,
    lastAuditAt: Timestamp.now(),
  };
}

/**
 * Calculates a security score from 0-100.
 */
function calculateSecurityScore(
  total: number,
  counts: { breached: number; weak: number; reused: number; old: number }
): number {
  if (total === 0) return 100;

  let penalty = 0;
  // Breaches are critical: -50 per unique breached password (capped)
  penalty += counts.breached * 50;
  // Reused: -20 per reused password
  penalty += counts.reused * 20;
  // Weak: -10 per weak password
  penalty += counts.weak * 10;
  // Old: -5 per old password
  penalty += counts.old * 5;

  // Scale penalty relative to total if needed, but breaches should almost always tank the score
  const score = Math.max(0, 100 - penalty);
  return Math.round(score);
}
