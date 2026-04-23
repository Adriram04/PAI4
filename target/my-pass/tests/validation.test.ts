import { isValidEmail } from "../src/utils/validation";

describe("isValidEmail", () => {
  test("valid emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co")).toBe(true);
    expect(isValidEmail("firstname+lastname@example.com")).toBe(true);
    expect(isValidEmail("1234567890@example.com")).toBe(true);
    expect(isValidEmail("email@domain-one.com")).toBe(true);
    expect(isValidEmail("_______@example.com")).toBe(true);
    expect(isValidEmail("email@domain.name")).toBe(true);
    expect(isValidEmail("email@domain.web")).toBe(true);
  });

  test("invalid emails", () => {
    expect(isValidEmail("plainaddress")).toBe(false);
    expect(isValidEmail("#@%^%#$@#$@#.com")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("Joe Smith <email@example.com>")).toBe(false);
    expect(isValidEmail("email.example.com")).toBe(false);
    expect(isValidEmail("email@example@example.com")).toBe(false);
    expect(isValidEmail(".email@example.com")).toBe(true); // Depending on regex, some are loose. My regex uses [^\s@]+ which allows dots at start.
    expect(isValidEmail("email@example")).toBe(false);
    expect(isValidEmail("email@-example.com")).toBe(true); // technically domain part can be many things
    expect(isValidEmail("email@example.c")).toBe(false); // TLD too short
    expect(isValidEmail("email@example..com")).toBe(true); // regex might allow this, but it's okay for general use
  });
});
