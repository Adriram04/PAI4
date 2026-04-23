  /**
 * Native Zero-Knowledge TOTP Service
 *
 * Implements Google Authenticator-compatible HMAC-SHA1 algorithm (TOTP).
 * Generates setup URIs and validates 6-digit numeric tokens against secrets.
 */

import * as OTPAuth from "otpauth";

/**
 * Generates a new random TOTP secret and its corresponding URI for QR code generation.
 * @param accountName The user's email/username.
 * @param issuer The app name displayed in Google Authenticator.
 * @returns An object containing the base32 secret and the otpauth:// URI.
 */
export function generateTOTPSecret(accountName: string, issuer: string = "MyPass"): { secret: string; uri: string } {
  const secretObj = new OTPAuth.Secret({ size: 20 });
  
  const totp = new OTPAuth.TOTP({
    issuer: issuer,
    label: accountName,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secretObj,
  });

  return {
    secret: secretObj.base32,
    uri: totp.toString(),
  };
}

/**
 * Validates a 6-digit numeric token against the previously saved base32 secret.
 * Allows a time-drift window of 1 interval (+/- 30 seconds).
 * @param secretBase32 The base32-encoded TOTP secret.
 * @param token The 6-digit PIN entered by the user.
 * @returns boolean `true` if the token is mathematically valid, `false` otherwise.
 */
export function verifyTOTPToken(secretBase32: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (err) {
    console.error("Failed to parse or validate TOTP token", err);
    return false;
  }
}
