import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { POST } from "@/app/api/auth/google/route";
import { GET as verify } from "@/app/auth/verify/route";
import { prisma, resetDb } from "../db";
import { authPayload, supabaseUser } from "../helpers/supabase";

const identity = supabaseUser({ app_metadata: { provider: "google", providers: ["google"] } });
function request(body: unknown = {}, origin: string | null = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/auth/google", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected provider request"); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server Google OAuth", () => {
  it("starts only Google with an HttpOnly PKCE verifier and no authenticated session", async () => {
    const response = await POST(request({ next: "/book/ABC", provider: "github", role: "ADMIN" }));
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    expect(url.origin + url.pathname).toBe("https://project.supabase.co/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    const callback = new URL(url.searchParams.get("redirect_to")!);
    expect(callback.origin + callback.pathname).toBe("http://localhost:3000/auth/verify");
    expect(callback.searchParams.get("next")).toBe("/book/ABC");
    expect(callback.searchParams.get("provider")).toBe("google");
    expect(response.cookies.getAll().some(cookie => cookie.name.includes("code-verifier") && cookie.httpOnly && cookie.sameSite === "lax" && cookie.value)).toBe(true);
    expect(response.cookies.getAll().some(cookie => /^pikol-auth(?:\.\d+)?$/.test(cookie.name))).toBe(false);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(fetch).not.toHaveBeenCalled();
    expect(await prisma.user.count()).toBe(0);
  });

  it.each(["CUSTOMER", "OWNER", "STAFF", "ADMIN"] as const)("completes real SDK PKCE exchange and applies %s permissions from the database", async role => {
    if (role !== "CUSTOMER") await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id, role } });
    const initiation = await POST(request({ next: "/book/ABC", audience: "owner", role: "ADMIN" }));
    const authorize = new URL((await initiation.json()).url);
    const challenge = authorize.searchParams.get("code_challenge");
    let exchanged = false;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const target = new URL(String(url));
      const body = JSON.parse(init.body);
      const proof = createHash("sha256").update(body.code_verifier ?? "").digest("base64url");
      if (target.pathname === "/auth/v1/token" && body.auth_code === "google-fixture-code" && proof === challenge) {
        exchanged = true;
        return new Response(JSON.stringify(authPayload(identity)));
      }
      return new Response(JSON.stringify({ msg: "Invalid PKCE proof" }), { status: 400 });
    }));
    const callback = new URL(authorize.searchParams.get("redirect_to")!);
    callback.searchParams.set("code", "google-fixture-code");
    const cookies = initiation.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
    const completion = await verify(new NextRequest(callback, { headers: { Cookie: cookies } }));
    expect(exchanged).toBe(true);
    const destination = role === "CUSTOMER" ? "/book/ABC" : "/owner/verify?next=%2Fbook%2FABC";
    expect(completion.headers.get("location")).toBe("http://localhost:3000" + destination);
    expect(completion.cookies.getAll().some(cookie => /^pikol-auth(?:\.\d+)?$/.test(cookie.name) && cookie.httpOnly && cookie.value)).toBe(true);
    expect((await prisma.user.findFirst())?.role).toBe(role);
  });

  it("rejects a Google code without its initiating browser verifier", async () => {
    const initiation = await POST(request());
    const authorize = new URL((await initiation.json()).url);
    const callback = new URL(authorize.searchParams.get("redirect_to")!);
    callback.searchParams.set("code", "stolen-fixture-code");
    const response = await verify(new NextRequest(callback));
    expect(response.headers.get("location")).toContain("error=oauth");
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each(["//evil.test", "https://evil.test", "/api/auth/google", "/auth/verify", "/login"])("rejects unsafe or looping return path %s", async next => {
    const response = await POST(request({ next }));
    const authorize = new URL((await response.json()).url);
    expect(new URL(authorize.searchParams.get("redirect_to")!).searchParams.get("next")).toBe("/bookings");
  });

  it("defaults venue access to the owner workspace without granting a role", async () => {
    const response = await POST(request({ audience: "owner" }));
    const authorize = new URL((await response.json()).url);
    expect(new URL(authorize.searchParams.get("redirect_to")!).searchParams.get("next")).toBe("/owner");
    expect(await prisma.user.count()).toBe(0);
  });

  it.each(["CUSTOMER", "OWNER", "ADMIN"] as const)("uses the verified %s default destination from ordinary sign-in", async role => {
    await prisma.user.create({ data: { email: identity.email, supabaseId: identity.id, role } });
    const initiation = await POST(request());
    const authorize = new URL((await initiation.json()).url);
    const callback = new URL(authorize.searchParams.get("redirect_to")!);
    expect(callback.searchParams.has("next")).toBe(false);
    callback.searchParams.set("code", "google-fixture-code");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(authPayload(identity)))));
    const completion = await verify(new NextRequest(callback, { headers: {
      Cookie: initiation.cookies.getAll().map(cookie => `${cookie.name}=${cookie.value}`).join("; "),
    } }));
    const expected = role === "CUSTOMER" ? "/bookings" : `/owner/verify?next=${encodeURIComponent(role === "ADMIN" ? "/admin" : "/owner")}`;
    expect(completion.headers.get("location")).toBe("http://localhost:3000" + expected);
  });

  it.each([null, "https://evil.test"])("rejects origin %s", async origin => {
    const response = await POST(request({}, origin));
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it("uses the canonical production app callback and secure verifier cookies", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://pikol-ph.vercel.app");
    const response = await POST(request({}, "https://pikol-ph.vercel.app"));
    const authorize = new URL((await response.json()).url);
    expect(new URL(authorize.searchParams.get("redirect_to")!).origin).toBe("https://pikol-ph.vercel.app");
    expect(response.cookies.getAll().every(cookie => cookie.secure && cookie.httpOnly)).toBe(true);
  });

  it("stays closed in preview and when Supabase is unconfigured", async () => {
    vi.stubEnv("APP_PREVIEW_MODE", "true");
    const preview = await POST(request());
    expect(preview.status).toBe(503);
    expect(preview.cookies.getAll()).toHaveLength(0);
    vi.stubEnv("APP_PREVIEW_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const missing = await POST(request());
    expect(missing.status).toBe(503);
    expect(missing.cookies.getAll()).toHaveLength(0);
  });
});
