import * as OTPAuth from "otpauth";
import {
  generateTOTPSecret,
  verifyTOTPToken,
} from "../src/services/totpService";

describe("TotpService", () => {
  test("generateTOTPSecret returns a base32 secret and otpauth URI", () => {
    const result = generateTOTPSecret("user@example.com", "MyPassTest");

    expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(result.uri).toContain("otpauth://totp/");
    expect(result.uri).toContain("MyPassTest");
    expect(result.uri).toContain("user%40example.com");
  });

  test("verifyTOTPToken accepts a valid current token", () => {
    const { secret } = generateTOTPSecret("user@example.com");
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    expect(verifyTOTPToken(secret, totp.generate())).toBe(true);
  });

  test("verifyTOTPToken rejects malformed secrets", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    expect(verifyTOTPToken("not-base32", "123456")).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
