import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, PATCH } from "@/app/api/auth/password/route";
import { POST as recover } from "@/app/api/auth/password/recover/route";
import { prisma, resetDb } from "../db";
import { supabaseUser } from "../helpers/supabase";

const provider = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), otp: vi.fn(), update: vi.fn(), getUser: vi.fn(), assurance: vi.fn(), write: undefined as undefined | ((cookies: unknown[]) => void) }));
vi.mock("@supabase/ssr", async original => ({ ...await original<typeof import("@supabase/ssr")>(), createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => {
  provider.write = options.cookies.setAll;
  return { auth: { signInWithPassword: provider.login, signUp: provider.signup, signInWithOtp: provider.otp, updateUser: provider.update, getUser: provider.getUser, mfa: { getAuthenticatorAssuranceLevel: provider.assurance } } };
} }));

const identity = supabaseUser();
const password = "A comfortable passphrase 7!";
const successful = () => {
  provider.write?.([{ name: "pikol-auth", value: "provider-session", options: { path: "/", httpOnly: true, sameSite: "lax" } }]);
  return { data: { user: identity, session: { user: identity, access_token: "private-token", refresh_token: "private-refresh" } }, error: null };
};
function request(body: unknown, method = "POST", origin: string | null = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/password", { method, headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
}

beforeEach(async () => {
  await resetDb(); vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  provider.login.mockImplementation(successful); provider.signup.mockImplementation(successful);
  provider.getUser.mockResolvedValue({ data: { user: identity }, error: null });
  provider.assurance.mockResolvedValue({ data: { currentLevel: "aal1", currentAuthenticationMethods: [{ method: "password" }] }, error: null });
  provider.otp.mockResolvedValue({ data: {}, error: null });
  provider.update.mockResolvedValue({ data: { user: identity }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("Supabase password authentication", () => {
  it("binds a verified player and commits only HttpOnly session cookies", async () => {
    const response = await POST(request({ action: "login", email: " Player@Example.com ", password, next: "/book/ABC" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, next: "/book/ABC" });
    expect(response.cookies.get("pikol-auth")?.httpOnly).toBe(true);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect((await prisma.user.findFirst())?.role).toBe("CUSTOMER");
  });
  it.each(["OWNER", "STAFF", "ADMIN"] as const)("requires authenticator verification after %s password sign-in", async role => {
    await prisma.user.create({ data: { email: identity.email, role, supabaseId: identity.id } });
    const response = await POST(request({ action: "login", email: identity.email, password, next: "/owner/venues/one/details" }));
    expect((await response.json()).next).toBe("/owner/verify?next=%2Fowner%2Fvenues%2Fone%2Fdetails");
  });
  it("does not trust client role or audience during account creation", async () => {
    const response = await POST(request({ action: "signup", email: identity.email, password, role: "OWNER", audience: "owner" }));
    expect(response.status).toBe(200);
    expect((await prisma.user.findFirst())?.role).toBe("CUSTOMER");
  });
  it("does not create an application account or session until email confirmation", async () => {
    provider.signup.mockResolvedValue({ data: { user: { ...identity, email_confirmed_at: null }, session: null }, error: null });
    const response = await POST(request({ action: "signup", email: identity.email, password }));
    expect(await response.json()).toEqual({ ok: true, confirmationRequired: true });
    expect(await prisma.user.count()).toBe(0); expect(response.cookies.getAll()).toHaveLength(0);
  });
  it.each(["//evil.test", "/login", "/owner/verify"])("rejects unsafe or looping player destination %s", async next => {
    expect((await (await POST(request({ action: "login", email: identity.email, password, next }))).json()).next).toBe("/bookings");
  });
  it.each(["https://evil.test", null])("rejects password mutations from origin %s", async origin => {
    expect((await POST(request({ action: "login", email: identity.email, password }, "POST", origin))).status).toBe(403);
  });
  it("rejects weak new passwords without rejecting existing short passwords at sign-in", async () => {
    expect((await POST(request({ action: "signup", email: identity.email, password: "short" }))).status).toBe(400);
    expect((await POST(request({ action: "login", email: identity.email, password: "short" }))).status).toBe(200);
  });
  it("keeps credential failures generic and never commits cookies", async () => {
    provider.login.mockResolvedValue({ data: null, error: { status: 400, code: "invalid_credentials", message: "Detailed provider error" } });
    const response = await POST(request({ action: "login", email: identity.email, password }));
    expect(response.status).toBe(401); expect(response.cookies.getAll()).toHaveLength(0);
    expect((await response.json()).error).toBe("Email or password is incorrect.");
  });
  it("rejects inactive and conflicting identity bindings without cookies", async () => {
    const row = await prisma.user.create({ data: { email: identity.email, isActive: false } });
    expect((await POST(request({ action: "login", email: identity.email, password }))).cookies.getAll()).toHaveLength(0);
    await prisma.user.update({ where: { id: row.id }, data: { isActive: true, supabaseId: "someone-else" } });
    expect((await POST(request({ action: "login", email: identity.email, password }))).status).toBe(409);
  });
  it.each([429, 503])("returns useful status %s without leaking provider details", async status => {
    provider.login.mockResolvedValue({ data: null, error: { status, message: "private provider detail" } });
    const response = await POST(request({ action: "login", email: identity.email, password }));
    expect(response.status).toBe(status); expect(JSON.stringify(await response.json())).not.toContain("private provider");
  });
  it("blocks password changes until the owner verifies MFA", async () => {
    await prisma.user.create({ data: { email: identity.email, role: "OWNER", supabaseId: identity.id } });
    expect((await PATCH(request({ password }, "PATCH"))).status).toBe(401);
    expect(provider.update).not.toHaveBeenCalled();
  });
  it("lets an authenticated verified player set a password for their own identity", async () => {
    await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id } });
    const response = await PATCH(request({ password, next: "/bookings", userId: "another-account" }, "PATCH"));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, next: "/bookings" });
    expect(provider.update).toHaveBeenCalledWith({ password });
  });
  it.each([undefined, null])("requires a confirmed provider email even when the application remembers an email (%s)", async confirmed => {
    await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id } });
    provider.getUser.mockResolvedValue({ data: { user: { ...identity, email_confirmed_at: confirmed, phone: "+639171234567", phone_confirmed_at: new Date().toISOString() } }, error: null });
    const response = await PATCH(request({ password }, "PATCH"));
    expect(response.status).toBe(400);
    expect(provider.update).not.toHaveBeenCalled();
  });
  it("rejects a missing provider email despite a remembered application email", async () => {
    await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id } });
    provider.getUser.mockResolvedValue({ data: { user: { ...identity, email: undefined, phone: "+639171234567", phone_confirmed_at: new Date().toISOString() } }, error: null });
    expect((await PATCH(request({ password }, "PATCH"))).status).toBe(400);
    expect(provider.update).not.toHaveBeenCalled();
  });
});

describe("password recovery with the existing verified email-link flow", () => {
  it("keeps repeated recovery responses identical for registered and unknown emails", async () => {
    expect(await (await recover(request({ email: identity.email }))).json()).toEqual({ ok: true });
    for (const code of ["over_email_send_rate_limit", "otp_disabled", "user_not_found"]) {
      provider.otp.mockResolvedValue({ data: null, error: { status: code === "over_email_send_rate_limit" ? 429 : 400, code } });
      const response = await recover(request({ email: identity.email }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
  });
  it("preserves global request throttling", async () => {
    provider.otp.mockResolvedValue({ data: null, error: { status: 429, code: "over_request_rate_limit" } });
    expect((await recover(request({ email: identity.email }))).status).toBe(429);
  });
  it("does not create new accounts or expose whether the email exists", async () => {
    const response = await recover(request({ email: "player@example.com", next: "/owner" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(provider.otp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ shouldCreateUser: false, emailRedirectTo: "http://localhost:3000/auth/verify?next=%2Freset-password%3Fnext%3D%252Fowner" }) }));
    provider.otp.mockResolvedValue({ data: null, error: { status: 400, code: "otp_disabled", message: "Signups not allowed for otp" } });
    expect(await (await recover(request({ email: "unknown@example.com" }))).json()).toEqual({ ok: true });
    expect(await prisma.user.count()).toBe(0);
  });
  it("uses the browser origin in local dev and the canonical origin in production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await recover(new NextRequest("http://0.0.0.0:3000/api/auth/password/recover", { method: "POST", headers: { Origin: "http://localhost:3000", Host: "localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ email: identity.email }) }));
    expect(provider.otp.mock.calls[0][0].options.emailRedirectTo).toMatch(/^http:\/\/localhost:3000\//);
  });
});
