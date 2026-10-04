import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { getSession, getSessionFromRequest } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guards";
import { PATCH as updateVenue } from "@/app/api/owner/venues/[id]/route";
import type { Role } from "@/generated/prisma";

const provider = vi.hoisted(() => ({ getUser: vi.fn(), assurance: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: provider.getUser, mfa: { getAuthenticatorAssuranceLevel: provider.assurance } } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  provider.getUser.mockReset();
  provider.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal1", currentAuthenticationMethods: [{ method: "magiclink" }] }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

async function identity(role: Role, verifiedFactor = true) {
  const user = await prisma.user.create({ data: { email: "owner-security@example.test", role, supabaseId: "supabase-owner-security" } });
  provider.getUser.mockResolvedValue({ data: { user: {
    id: user.supabaseId,
    user_metadata: { role: "ADMIN" }, // user-editable metadata must never grant access
    factors: verifiedFactor ? [{ id: "totp-one", factor_type: "totp", status: "verified" }] : [],
  } }, error: null });
  return user;
}

describe("mandatory authenticator verification for privileged accounts", () => {
  it.each(["OWNER", "STAFF", "ADMIN"] as const)("denies %s with only a first factor", async role => {
    await identity(role);
    expect(await getSession()).toBeNull();
    expect(await getSessionFromRequest(new NextRequest("http://localhost:3000"))).toBeNull();
    await expect(requireRole("OWNER", "STAFF")).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("blocks a direct venue mutation before MFA without changing the venue", async () => {
    const owner = await identity("OWNER");
    const venue = await prisma.venue.create({ data: { ownerId: owner.id, slug: "secure-venue", name: "Before", city: "Davao City" } });
    const response = await updateVenue(new NextRequest("http://localhost:3000/api/owner/venues/" + venue.id, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "After" }),
    }), { params: Promise.resolve({ id: venue.id }) });
    expect(response.status).toBe(401);
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).name).toBe("Before");
  });

  it("accepts a verified TOTP session and still enforces the live role", async () => {
    const owner = await identity("OWNER");
    provider.assurance.mockResolvedValue({ data: { currentLevel: "aal2", currentAuthenticationMethods: [{ method: "magiclink" }, { method: "totp" }] }, error: null });
    expect(await getSession()).toMatchObject({ id: owner.id, role: "OWNER" });
    await prisma.user.update({ where: { id: owner.id }, data: { role: "CUSTOMER" } });
    await expect(requireRole("OWNER")).rejects.toMatchObject({ httpStatus: 403 });
    await prisma.user.update({ where: { id: owner.id }, data: { isActive: false } });
    expect(await getSession()).toBeNull();
  });

  it("rejects a stale AAL2 token after the authenticator is removed", async () => {
    await identity("OWNER", false);
    provider.assurance.mockResolvedValue({ data: { currentLevel: "aal2", currentAuthenticationMethods: [{ method: "totp" }] }, error: null });
    expect(await getSession()).toBeNull();
  });

  it("requires an authenticator rather than another SMS code", async () => {
    await identity("OWNER");
    provider.assurance.mockResolvedValue({ data: { currentLevel: "aal2", currentAuthenticationMethods: [{ method: "phone" }] }, error: null });
    expect(await getSession()).toBeNull();
  });

  it.each(["returned error", "network failure"])("fails closed on an assurance %s", async failure => {
    await identity("OWNER");
    if (failure === "network failure") provider.assurance.mockRejectedValue(new Error("offline"));
    else provider.assurance.mockResolvedValue({ data: null, error: { message: "Invalid session" } });
    expect(await getSession()).toBeNull();
  });

  it("retains player sign-in and ignores a forged metadata role", async () => {
    const customer = await identity("CUSTOMER", false);
    expect(await getSession()).toMatchObject({ id: customer.id, role: "CUSTOMER" });
    await expect(requireRole("OWNER")).rejects.toMatchObject({ httpStatus: 403 });
  });
});
