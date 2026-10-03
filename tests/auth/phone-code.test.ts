import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { authPayload, phoneUser } from "../helpers/supabase";
import { normalizePhone, requestPhoneCode, consumePhoneCode } from "@/lib/auth/phone-code";

vi.mock("server-only", () => ({}));
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (String(url).includes("/otp")) return new Response("{}");
    const body = JSON.parse(init.body);
    return body.token === "123456" ? new Response(JSON.stringify(authPayload(phoneUser(body.phone)))) : new Response(JSON.stringify({ msg: "Invalid code" }), { status: 400 });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

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
    expect(stored.provider).toBe("supabase");
    expect(stored.codeHash).toBeNull();
    expect(challenge).not.toHaveProperty("devCode");
    const user = await consumePhoneCode(challenge.id, "123456");
    expect(user?.email).toBeNull();
    expect(user?.mobile).toBe("+639171234567");
    expect(await consumePhoneCode(challenge.id, "123456")).toBeNull();
  });

  it("rejects incorrect and expired codes without creating an account", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const wrong = "000000";
    expect(await consumePhoneCode(challenge.id, wrong)).toBeNull();
    await prisma.phoneChallenge.update({ where: { id: challenge.id }, data: { expiresAt: new Date(0) } });
    expect(await consumePhoneCode(challenge.id, "123456")).toBeNull();
    expect(await prisma.user.count()).toBe(0);
  });

  it("locks a challenge after five incorrect attempts", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const wrong = "000000";
    for (let attempt = 0; attempt < 5; attempt++) expect(await consumePhoneCode(challenge.id, wrong)).toBeNull();
    expect(await consumePhoneCode(challenge.id, "123456")).toBeNull();
  });

  it("allows only one concurrent verification to create a session", async () => {
    const challenge = await requestPhoneCode("09171234567");
    const results = await Promise.all([consumePhoneCode(challenge.id, "123456"), consumePhoneCode(challenge.id, "123456")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("enforces resend cooldown and invalidates the previous challenge", async () => {
    const first = await requestPhoneCode("09171234567");
    await expect(requestPhoneCode("+639171234567")).rejects.toMatchObject({ httpStatus: 429 });
    await prisma.phoneChallenge.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const second = await requestPhoneCode("09171234567");
    expect(await consumePhoneCode(first.id, "123456")).toBeNull();
    expect(await consumePhoneCode(second.id, "123456")).not.toBeNull();
  });

  it("never grants access to an email account through an unverified contact number", async () => {
    const existing = await prisma.user.create({ data: { email: "owner@test.com", mobile: "09171234567", role: "OWNER" } });
    const challenge = await requestPhoneCode("09171234567");
    const phoneUser = await consumePhoneCode(challenge.id, "123456");
    expect(phoneUser?.id).not.toBe(existing.id);
    expect(phoneUser?.role).toBe("CUSTOMER");
  });

  it("rejects inactive accounts", async () => {
    const challenge = await requestPhoneCode("09171234567");
    await prisma.user.create({ data: { verifiedMobile: "+639171234567", isActive: false } });
    expect(await consumePhoneCode(challenge.id, "123456")).toBeNull();
  });

  it("blocks the 21st request across different numbers from one client", async () => {
    for (let index = 0; index < 20; index++) {
      await requestPhoneCode(`0917${String(index).padStart(7, "0")}`, "trusted-client");
    }
    await expect(requestPhoneCode("09179999999", "trusted-client")).rejects.toMatchObject({ httpStatus: 429 });
  });
});
