import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";
import { decryptField, encryptField, identityHash, mask } from "../crypto";

describe("password hashing (scrypt)", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(h, "correct horse battery")).toBe(true);
    expect(await verifyPassword(h, "wrong password!!")).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });
});

describe("field encryption", () => {
  it("round-trips and uses a fresh IV", () => {
    const a = encryptField("22212345678");
    expect(decryptField(a)).toBe("22212345678");
    expect(encryptField("22212345678")).not.toBe(a);
  });
  it("detects tampering", () => {
    const parts = encryptField("22212345678").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptField(parts.join("."))).toThrow();
  });
  it("hashes identities deterministically and masks for display", () => {
    expect(identityHash("123")).toBe(identityHash(" 123 "));
    expect(mask("22212345678")).toBe("••••••••678");
  });
});
