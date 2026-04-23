/**
 * Password Generator Utility
 *
 * Generates cryptographically random passwords using Web Crypto API.
 */

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

export interface PasswordOptions {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  includeLowercase: true,
  includeUppercase: true,
  includeDigits: true,
  includeSymbols: true,
};

/**
 * Generate a cryptographically random password.
 *
 * Uses crypto.getRandomValues() for true randomness (not Math.random).
 */
export function generatePassword(options: PasswordOptions = DEFAULT_OPTIONS): string {
  let charset = "";
  if (options.includeLowercase) charset += LOWERCASE;
  if (options.includeUppercase) charset += UPPERCASE;
  if (options.includeDigits) charset += DIGITS;
  if (options.includeSymbols) charset += SYMBOLS;

  if (charset.length === 0) {
    throw new Error("At least one character set must be selected");
  }

  const length = Math.max(8, Math.min(128, options.length));
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  let password = "";

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  // Ensure at least one character from each selected category
  const guarantees: string[] = [];
  if (options.includeLowercase) guarantees.push(LOWERCASE);
  if (options.includeUppercase) guarantees.push(UPPERCASE);
  if (options.includeDigits) guarantees.push(DIGITS);
  if (options.includeSymbols) guarantees.push(SYMBOLS);

  const chars = password.split("");
  const extraRandom = crypto.getRandomValues(new Uint8Array(guarantees.length));
  for (let i = 0; i < guarantees.length; i++) {
    const pos = extraRandom[i] % length;
    const charSetRandom = crypto.getRandomValues(new Uint8Array(1));
    chars[pos] = guarantees[i][charSetRandom[0] % guarantees[i].length];
  }

  return chars.join("");
}

/**
 * Estimate password strength (simple heuristic).
 */
export function estimateStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  score = Math.min(4, score);

  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["#ff4444", "#ff8800", "#ffcc00", "#44bb44", "#00cc88"];

  return {
    score,
    label: labels[score],
    color: colors[score],
  };
}
