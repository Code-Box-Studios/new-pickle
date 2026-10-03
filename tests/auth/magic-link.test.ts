import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { requestMagicLink, resolveMagicLinkBase } from "@/lib/auth/magic-link";
vi.mock("server-only", () => ({}));
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase email sign-in", () => {
  it("requests a provider link without creating an unverified application account", async () => {
    const sent: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      sent.body = JSON.parse(init.body);
      return new Response("{}", { status: 200 });
    }));
    await requestMagicLink(" Player@Example.com ", { origin: "http://localhost:3000", next: "/book/ABC" });
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.magicLinkToken.count()).toBe(0);
    expect(sent.body).toMatchObject({ email: "player@example.com", create_user: true });
  });
  it("rejects invalid addresses without contacting the provider", async () => {
    await expect(requestMagicLink("nope")).rejects.toMatchObject({ httpStatus: 400 });
  });
  it("surfaces throttling without claiming delivery succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "rate limited" }), { status: 429 })));
    await expect(requestMagicLink("player@example.com")).rejects.toMatchObject({ httpStatus: 429 });
  });
  it("requires Supabase configuration in development too", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(requestMagicLink("player@example.com")).rejects.toMatchObject({ httpStatus: 503 });
  });
});
describe("canonical sign-in destinations", () => {
  it("uses request origin in local development", () => {
    expect(resolveMagicLinkBase("http://172.16.14.20:3000")).toBe("http://172.16.14.20:3000");
  });
  it("ignores untrusted production hosts", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://pikol.example");
    expect(resolveMagicLinkBase("https://attacker.test")).toBe("https://pikol.example");
  });
});
