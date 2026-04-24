import { describe, expect, it } from "vitest";
import {
  getItemNameValidationError,
  getPasswordValidationError,
  isValidSixDigitPin,
  normalizeEmail,
} from "@/lib/validation";

describe("validation", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  User@Example.com ")).toBe("user@example.com");
  });

  it("enforces the password policy", () => {
    expect(getPasswordValidationError("alllowercase12")).toBe(
      "Password must include uppercase, lowercase, and a number"
    );
    expect(getPasswordValidationError("StrongPass1")).toBeNull();
  });

  it("validates six digit pins", () => {
    expect(isValidSixDigitPin("123456")).toBe(true);
    expect(isValidSixDigitPin("12345a")).toBe(false);
  });

  it("rejects unsafe item names", () => {
    expect(getItemNameValidationError("../secret", "File name")).toBe(
      "File name contains invalid characters"
    );
    expect(getItemNameValidationError("Quarterly Report.pdf", "File name")).toBeNull();
  });
});
