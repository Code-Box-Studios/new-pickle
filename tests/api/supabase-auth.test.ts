import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { authPayload, supabaseUser } from "../helpers/supabase";
import { GET as verify } from "@/app/auth/verify/route";
import { POST as logout } from "@/app/api/auth/logout/route";
vi.mock("server-only", () => ({}));

beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (String(url).includes("/logout")) return new Response(null, { status: 204 });
    const body = JSON.parse(init.body);
    return body.token_hash === "valid-hash" ? new Response(JSON.stringify(authPayload(supabaseUser()))) : new Response(JSON.stringify({ msg: "Expired token" }), { status: 403 });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase email callbacks and logout", () => {
  it("verifies a token hash, creates an account, and commits HttpOnly cookies", async () => {
    const response = await verify(new NextRequest("http://localhost:3000/auth/verify?token_hash=valid-hash&type=email&next=/book/ABC"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/book/ABC");
    expect(response.cookies.getAll().some(cookie => cookie.name.startsWith("pikol-auth") && cookie.httpOnly)).toBe(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await prisma.user.count()).toBe(1);
  });
  it("rejects expired links without a session or application account", async () => {
    const response = await verify(new NextRequest("http://localhost:3000/auth/verify?token_hash=expired&type=email"));
    expect(response.headers.get("location")).toContain("/login?error=invalid");
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });
  it("never commits cookies for inactive accounts", async () => {
    await prisma.user.create({ data: { email: "player@example.com", isActive: false } });
    const response = await verify(new NextRequest("http://localhost:3000/auth/verify?token_hash=valid-hash&type=email"));
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get("location")).toContain("/login?error=invalid");
  });
  it("never commits cookies when a verified identity conflicts with an existing binding", async () => {
    await prisma.user.create({ data: { email: "player@example.com", supabaseId: "another-provider-user" } });
    const response = await verify(new NextRequest("http://localhost:3000/auth/verify?token_hash=valid-hash&type=email"));
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get("location")).toContain("/login?error=invalid");
    expect((await prisma.user.findFirst())?.supabaseId).toBe("another-provider-user");
  });
  it("keeps redirects local and uses the production canonical origin", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://pikol.example");
    const response = await verify(new NextRequest("https://untrusted-host.test/auth/verify?token_hash=valid-hash&type=email&next=//other.test"));
    expect(response.headers.get("location")).toBe("https://pikol.example/bookings");
    expect(response.cookies.getAll().every(cookie => cookie.secure)).toBe(true);
  });
  it("clears every session chunk and ignores cross-site logout", async () => {
    vi.stubGlobal("fetch", vi.fn(async url => String(url).includes("/logout")
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(authPayload(supabaseUser({ user_metadata: { profile: "z".repeat(10_000) } }))))));
    const first = await verify(new NextRequest("http://localhost:3000/auth/verify?token_hash=valid-hash&type=email"));
    expect(first.cookies.getAll().filter(c => /^pikol-auth\.\d+$/.test(c.name)).length).toBeGreaterThan(1);
    const cookie = first.cookies.getAll().map(c => `${c.name}=${c.value}`).join("; ") + "; pikol-auth.99=stale; rallypoint_session=legacy";
    const response = await logout(new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST", headers: { cookie, origin: "http://localhost:3000" } }));
    expect(response.status).toBe(303);
    expect(response.cookies.getAll().filter(c => c.name.startsWith("pikol-auth")).every(c => c.maxAge === 0)).toBe(true);
    expect(response.cookies.getAll().length).toBeGreaterThan(0);
    expect(response.cookies.get("pikol-auth.99")?.maxAge).toBe(0);
    expect(response.cookies.get("rallypoint_session")?.maxAge).toBe(0);
    expect((await logout(new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "https://other.test" } }))).status).toBe(403);
  });
});
