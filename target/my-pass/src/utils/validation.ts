/**
 * Validation Utilities
 */

/**
 * Validates an email address using a robust regular expression.
 * This pattern checks for a non-empty user part, an @ symbol, 
 * a non-empty domain part, and at least a two-letter TLD.
 *
 * @param email The email string to validate
 * @returns true if the email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return emailPattern.test(email.trim());
}
