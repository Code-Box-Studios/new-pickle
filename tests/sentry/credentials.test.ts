import { describe, it, expect } from "vitest";
import { credentialCipher } from "@/lib/sentry/credentials";
import { ValidationError } from "@/lib/booking/errors";

describe("credentialCipher", () => {
  it("round-trips a secret", () => {
    const secret = "sk_live_example_1234567890";
    const enc = credentialCipher.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(credentialCipher.decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(credentialCipher.encrypt("x")).not.toBe(credentialCipher.encrypt("x"));
  });

  it("rejects a tampered payload", () => {
    const enc = credentialCipher.encrypt("secret");
    const tampered = enc.slice(0, -2) + (enc.endsWith("aa") ? "bb" : "aa");
    expect(() => credentialCipher.decrypt(tampered)).toThrow(ValidationError);
  });

  it("rejects a malformed payload", () => {
    expect(() => credentialCipher.decrypt("not-a-valid-payload")).toThrow(ValidationError);
  });
});
