import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { getSession, getSessionFromRequest } from "@/lib/auth/session";
import { NextRequest } from "next/server";

const provider = vi.hoisted(() => ({ getUser: vi.fn(), setAll: vi.fn(), assurance: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: provider.getUser, mfa: { getAuthenticatorAssuranceLevel: provider.assurance } } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => ({ value: "forged-old-jwt" }), getAll: () => [{ name: "pikol-auth", value: "verified-by-provider" }], set: provider.setAll,
}) }));
vi.mock("server-only", () => ({}));

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  provider.getUser.mockReset();
  provider.assurance.mockResolvedValue({ data: { currentLevel: "aal2", currentAuthenticationMethods: [{ method: "totp" }] }, error: null });
});

describe("Supabase session authorization", () => {
  it("returns the live application role for a provider-verified identity", async () => {
    const user = await prisma.user.create({ data: { email: "admin@example.com", role: "ADMIN" } });
    provider.getUser.mockResolvedValue({ data: { user: { id: "supabase-admin", email: user.email, factors: [{ factor_type: "totp", status: "verified" }] } }, error: null });
    await prisma.user.update({ where: { id: user.id }, data: { supabaseId: "supabase-admin" } });
    expect(await getSession()).toMatchObject({ id: user.id, role: "ADMIN" });
    await prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    expect(await getSession()).toMatchObject({ id: user.id, role: "CUSTOMER" });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await getSession()).toBeNull();
  });

  it("rejects forged and provider-revoked sessions", async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect(await getSession()).toBeNull();
    expect(await getSessionFromRequest(new NextRequest("http://localhost:3000", { headers: { cookie: "rallypoint_session=forged" } }))).toBeNull();
  });
});
