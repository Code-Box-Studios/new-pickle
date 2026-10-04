import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { GET, POST } from "@/app/api/auth/mfa/route";

const provider = vi.hoisted(() => ({ getUser: vi.fn(), assurance: vi.fn(), list: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), verify: vi.fn(), writeCookies: undefined as undefined | ((values: unknown[]) => void) }));
vi.mock("@supabase/ssr", async importOriginal => ({
  ...await importOriginal<typeof import("@supabase/ssr")>(),
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (values: unknown[]) => void } }) => {
    provider.writeCookies = options.cookies.setAll;
    return { auth: { getUser: provider.getUser, mfa: {
      getAuthenticatorAssuranceLevel: provider.assurance,
      listFactors: provider.list, enroll: provider.enroll, unenroll: provider.unenroll,
      challengeAndVerify: provider.verify,
    } } };
  },
}));

const pendingFactor = { id: "pending-factor", factor_type: "totp", status: "unverified", friendly_name: "Pikol venue workspace" };
const verifiedFactor = { ...pendingFactor, id: "verified-factor", status: "verified" };

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.clearAllMocks();
  await prisma.user.create({ data: { email: "owner-mfa@example.test", role: "OWNER", supabaseId: "owner-mfa-id" } });
  provider.getUser.mockResolvedValue({ data: { user: { id: "owner-mfa-id", factors: [] } }, error: null });
  provider.assurance.mockResolvedValue({ data: { currentLevel: "aal1", currentAuthenticationMethods: [{ method: "magiclink" }] }, error: null });
  provider.list.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
  provider.enroll.mockResolvedValue({ data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml;utf-8,example", secret: "manual-key", uri: "private-uri" } }, error: null });
  provider.unenroll.mockResolvedValue({ data: {}, error: null });
  provider.verify.mockImplementation(async () => {
    provider.writeCookies?.([{ name: "pikol-auth", value: "upgraded-session", options: { httpOnly: true, path: "/", sameSite: "lax" } }]);
    return { data: { user: { id: "owner-mfa-id" }, access_token: "secret-access", refresh_token: "secret-refresh" }, error: null };
  });
});
afterEach(() => vi.unstubAllEnvs());

function request(body?: unknown, origin: string | null = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/mfa", body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  });
}

describe("owner authenticator endpoint", () => {
  it("denies anonymous users and customer accounts", async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request())).status).toBe(401);
    provider.getUser.mockResolvedValue({ data: { user: { id: "owner-mfa-id" } }, error: null });
    await prisma.user.update({ where: { supabaseId: "owner-mfa-id" }, data: { role: "CUSTOMER" } });
    expect((await POST(request({ action: "enroll" }))).status).toBe(403);
  });

  it("returns only verified TOTP factor labels and IDs without caching", async () => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor, { ...verifiedFactor, secret: "do-not-return" }], totp: [verifiedFactor] }, error: null });
    const response = await GET(request());
    expect(await response.json()).toEqual({ factors: [{ id: "verified-factor", name: "Pikol venue workspace" }] });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it.each(["https://other.test", null])("rejects mutation origin %s", async origin => {
    const response = await POST(request({ action: "enroll" }, origin));
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it("starts first-time setup with only the factor ID, QR and manual key", async () => {
    const response = await POST(request({ action: "enroll" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "new-factor", qrCode: "data:image/svg+xml;utf-8,example", secret: "manual-key" });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it("never replaces an existing verified authenticator", async () => {
    provider.list.mockResolvedValue({ data: { all: [verifiedFactor], totp: [verifiedFactor] }, error: null });
    expect((await POST(request({ action: "enroll" }))).status).toBe(409);
  });

  it("never deletes a factor verified after an earlier status snapshot", async () => {
    let currentStatus = "unverified";
    provider.list.mockImplementation(async () => {
      const snapshot = { ...pendingFactor, status: currentStatus };
      currentStatus = "verified"; // Another tab verifies after this snapshot.
      return { data: { all: [snapshot], totp: [] }, error: null };
    });
    provider.unenroll.mockImplementation(async () => {
      currentStatus = "deleted";
      return { data: {}, error: null };
    });
    await POST(request({ action: "enroll" }));
    expect(provider.unenroll).not.toHaveBeenCalled();
    expect(currentStatus).toBe("verified");
  });

  it("can restart abandoned setup without deleting factors or reusing names", async () => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null });
    expect((await POST(request({ action: "enroll" }))).status).toBe(200);
    expect((await POST(request({ action: "enroll" }))).status).toBe(200);
    expect(provider.unenroll).not.toHaveBeenCalled();
    const names = provider.enroll.mock.calls.map(([options]) => options.friendlyName);
    expect(names[0]).not.toBe(names[1]);
  });

  it.each([0, 502, 503])("returns retryable unavailability for verification provider status %s", async status => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null });
    provider.verify.mockResolvedValue({ data: null, error: { message: "Provider unavailable", status } });
    const response = await POST(request({ action: "verify", factorId: pendingFactor.id, code: "123456" }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("mfa_unavailable");
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it("rejects a factor that does not belong to the signed-in account", async () => {
    expect((await POST(request({ action: "verify", factorId: "someone-elses-factor", code: "123456" }))).status).toBe(400);
  });

  it("rejects malformed or incorrect codes without upgrading cookies", async () => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null });
    expect((await POST(request({ action: "verify", factorId: pendingFactor.id, code: "abc123" }))).status).toBe(400);
    provider.verify.mockResolvedValue({ data: null, error: { message: "Invalid TOTP", status: 400 } });
    const response = await POST(request({ action: "verify", factorId: pendingFactor.id, code: "123456" }));
    expect(response.status).toBe(400);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect((await response.json()).error).toContain("code");
  });

  it("writes HttpOnly cookies after verification and exposes no tokens", async () => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null });
    const response = await POST(request({ action: "verify", factorId: pendingFactor.id, code: "123456", next: "/owner/venues/one/details" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, next: "/owner/venues/one/details" });
    expect(response.cookies.get("pikol-auth")?.httpOnly).toBe(true);
  });

  it.each(["//other.test", "/owner/verify?next=/owner", "/owner/login"])("avoids unsafe or looping destination %s", async next => {
    provider.list.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null });
    expect(await (await POST(request({ action: "verify", factorId: pendingFactor.id, code: "123456", next }))).json()).toEqual({ ok: true, next: "/owner" });
  });

  it("returns a private retryable failure when the provider is unavailable", async () => {
    provider.list.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
});
