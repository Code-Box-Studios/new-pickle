import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { POST } from "@/app/api/auth/callback/route";
import { POST as signup } from "@/app/api/auth/password/route";
import { POST as recover } from "@/app/api/auth/password/recover/route";
import { GET as verify } from "@/app/auth/verify/route";
import { prisma, resetDb } from "../db";
import { authPayload, supabaseUser } from "../helpers/supabase";

const identity = supabaseUser();
const session = authPayload(identity);
function request(body: unknown = { access_token: session.access_token, refresh_token: session.refresh_token }, origin: string | null = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (String(url) === "https://project.supabase.co/auth/v1/user" && new Headers(init?.headers).get("authorization") === `Bearer ${session.access_token}`) {
      return new Response(JSON.stringify(identity));
    }
    return new Response(JSON.stringify({ msg: "Invalid session" }), { status: 401 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("default Supabase email callback sessions", () => {
  it.each(["signup", "recovery"])("retains generated %s verifier cookies through the complete default-template callback", async action => {
    let challenge = "";
    let method = "";
    let emailRedirect = "";
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const target = new URL(String(url));
      const body = JSON.parse(init.body);
      if (["/auth/v1/signup", "/auth/v1/otp"].includes(target.pathname)) {
        challenge = body.code_challenge;
        method = body.code_challenge_method;
        emailRedirect = target.searchParams.get("redirect_to")!;
        return new Response(JSON.stringify(action === "signup" ? { ...identity, email_confirmed_at: undefined } : {}));
      }
      const proof = method === "s256" ? createHash("sha256").update(body.code_verifier ?? "").digest("base64url") : body.code_verifier;
      if (target.pathname === "/auth/v1/token" && body.auth_code === "fixture-code" && proof === challenge) {
        return new Response(JSON.stringify(authPayload(identity)));
      }
      return new Response(JSON.stringify({ msg: "Invalid PKCE proof" }), { status: 400 });
    }));
    const initiation = await (action === "signup" ? signup : recover)(request({ action: "signup", email: identity.email, password: "A comfortable passphrase 7!", next: "/book/ABC" }));
    expect(initiation.status).toBe(200);
    expect(challenge).toBeTruthy();
    const cookies = initiation.cookies.getAll();
    expect(cookies.some(cookie => cookie.name === "pikol-auth-code-verifier" && cookie.httpOnly && cookie.value)).toBe(true);
    expect(cookies.some(cookie => cookie.name === "pikol-auth" || cookie.name.startsWith("pikol-auth."))).toBe(false);
    expect(await prisma.user.count()).toBe(0);
    const callback = new URL(emailRedirect);
    callback.searchParams.set("code", "fixture-code");
    const completion = await verify(new NextRequest(callback, { headers: { Cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") } }));
    const expected = action === "signup" ? "/book/ABC" : "/reset-password?next=%2Fbook%2FABC";
    expect(completion.headers.get("location")).toBe("http://localhost:3000" + expected);
    expect(completion.cookies.getAll().some(cookie => cookie.name.startsWith("pikol-auth") && cookie.httpOnly && cookie.value)).toBe(true);
    expect(await prisma.user.count()).toBe(1);
  });

  it("verifies the returned token with Supabase and creates a private server session", async () => {
    const response = await POST(request({ ...session, next: "/book/ABC" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, next: "/book/ABC" });
    expect(response.cookies.getAll().some(cookie => cookie.name.startsWith("pikol-auth") && cookie.value && cookie.httpOnly && cookie.sameSite === "lax")).toBe(true);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect((await prisma.user.findFirst())?.supabaseId).toBe(identity.id);
  });

  it("rejects a provider-rejected session even when the browser supplies a verified identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Invalid JWT" }), { status: 401 })));
    const response = await POST(request({ ...session, user: identity, role: "ADMIN" }));
    expect(response.status).toBe(401);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
    expect(JSON.stringify(await response.json())).not.toContain(session.access_token);
  });

  it.each(["OWNER", "STAFF", "ADMIN"] as const)("sends %s through authenticator verification", async role => {
    await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id, role } });
    const response = await POST(request({ ...session, next: "/owner/venues" }));
    expect(await response.json()).toEqual({ ok: true, next: "/owner/verify?next=%2Fowner%2Fvenues" });
  });

  it.each(["https://evil.test", null])("rejects callback session writes from origin %s", async origin => {
    const response = await POST(request(session, origin));
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([{}, { access_token: session.access_token }, { access_token: {}, refresh_token: "refresh" }, { access_token: "x".repeat(20000), refresh_token: "refresh" }])("rejects incomplete or oversized credentials", async body => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("never commits the provider's cookies for inactive accounts or conflicting identity bindings", async () => {
    const row = await prisma.user.create({ data: { email: identity.email, isActive: false } });
    const inactive = await POST(request());
    expect(inactive.status).toBe(401);
    expect(inactive.cookies.getAll()).toHaveLength(0);
    await prisma.user.update({ where: { id: row.id }, data: { isActive: true, supabaseId: "different-identity" } });
    const conflicting = await POST(request());
    expect(conflicting.status).toBe(409);
    expect(conflicting.cookies.getAll()).toHaveLength(0);
  });

  it.each([{ email_confirmed_at: undefined }, { is_anonymous: true }])("rejects unconfirmed or anonymous provider identities", async fields => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(supabaseUser(fields)))));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("does not grant roles from browser input and rejects external return paths", async () => {
    const response = await POST(request({ ...session, role: "OWNER", next: "//evil.test" }));
    expect(await response.json()).toEqual({ ok: true, next: "/bookings" });
    expect((await prisma.user.findFirst())?.role).toBe("CUSTOMER");
  });

  it("allows a verified recovery session to reach the password reset screen", async () => {
    const response = await POST(request({ ...session, next: "/reset-password?next=%2Fbookings" }));
    expect(await response.json()).toEqual({ ok: true, next: "/reset-password?next=%2Fbookings" });
  });

  it("keeps account access closed in public preview mode", async () => {
    vi.stubEnv("APP_PREVIEW_MODE", "true");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });
});
