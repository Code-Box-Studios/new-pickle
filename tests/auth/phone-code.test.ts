import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { normalizePhone, requestPhoneCode, consumePhoneCode } from "@/lib/auth/phone-code";

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

describe("phone sign-in", () => {
  it("normalizes Philippine mobile formats and rejects other input", () => {
    for (const phone of ["0917 123 4567", "+63 917 123 4567", "639171234567", "9171234567"])
      expect(normalizePhone(phone)).toBe("+639171234567");
    for (const phone of ["hello", "0917", "+6391712345678", "09171234567<script>"])
      expect(() => normalizePhone(phone)).toThrow();
  });

  it("creates an account only after verifying a single-use code", async () => {
    const challenge = await requestPhoneCode("09171234567");
    expect(await prisma.user.count()).toBe(0);
    const stored = await prisma.phoneChallenge.findUniqueOrThrow({ where: { id: challenge.id } });
    expect(stored.codeHash).not.toContain(challenge.devCode!);
    const user = await consumePhoneCode(challenge.id, challenge.devCode!);
    expect(user?.email).toBeNull();
    expect(user?.mobile).toBe("+639171234567");
    expect(await consumePhoneCode(challenge.id, challenge.devCode!)).toBeNull();
  });

  it("rejects incorrect and expired codes without creating an account", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const wrong = challenge.devCode === "000000" ? "111111" : "000000";
    expect(await consumePhoneCode(challenge.id, wrong)).toBeNull();
    await prisma.phoneChallenge.update({ where: { id: challenge.id }, data: { expiresAt: new Date(0) } });
    expect(await consumePhoneCode(challenge.id, challenge.devCode!)).toBeNull();
    expect(await prisma.user.count()).toBe(0);
  });

  it("locks a challenge after five incorrect attempts", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const wrong = challenge.devCode === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt++) expect(await consumePhoneCode(challenge.id, wrong)).toBeNull();
    expect(await consumePhoneCode(challenge.id, challenge.devCode!)).toBeNull();
  });

  it("allows only one concurrent verification to create a session", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const results = await Promise.all([consumePhoneCode(challenge.id, challenge.devCode!), consumePhoneCode(challenge.id, challenge.devCode!)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("enforces resend cooldown and invalidates the previous challenge", async () => {
    const first = await requestPhoneCode("09171234567");
    await expect(requestPhoneCode("+639171234567")).rejects.toMatchObject({ httpStatus: 429 });
    await prisma.phoneChallenge.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const second = await requestPhoneCode("09171234567");
    expect(await consumePhoneCode(first.id, first.devCode!)).toBeNull();
    expect(await consumePhoneCode(second.id, second.devCode!)).not.toBeNull();
  });

  it("never grants access to an email account through an unverified contact number", async () => {
    const existing = await prisma.user.create({ data: { email: "owner@test.com", mobile: "09171234567", role: "OWNER" } });
    const challenge = await requestPhoneCode("09171234567");
    const phoneUser = await consumePhoneCode(challenge.id, challenge.devCode!);
    expect(phoneUser?.id).not.toBe(existing.id);
    expect(phoneUser?.role).toBe("CUSTOMER");
  });

  it("rejects inactive accounts and development challenges in production", async () => {
    const challenge = await requestPhoneCode("09171234567");
    vi.stubEnv("NODE_ENV", "production");
    expect(await consumePhoneCode(challenge.id, challenge.devCode!)).toBeNull();
    vi.stubEnv("NODE_ENV", "test");
    await prisma.user.create({ data: { verifiedMobile: "+639171234567", isActive: false } });
    expect(await consumePhoneCode(challenge.id, challenge.devCode!)).toBeNull();
  });

  it("blocks the 21st request across different numbers from one client", async () => {
    for (let index = 0; index < 20; index++) {
      await requestPhoneCode(`0917${String(index).padStart(7, "0")}`, "trusted-client");
    }
    await expect(requestPhoneCode("09179999999", "trusted-client")).rejects.toMatchObject({ httpStatus: 429 });
  });
});
