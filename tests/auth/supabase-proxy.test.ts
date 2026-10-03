import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { authPayload, supabaseUser } from "../helpers/supabase";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase session refresh", () => {
  it("forwards refreshed cookies to both rendering and the browser without caching them", async () => {
    const original = { ...authPayload(supabaseUser()), expires_at: Math.floor(Date.now()/1000)-60 };
    const encoded = `base64-${Buffer.from(JSON.stringify(original)).toString("base64url")}`;
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).includes("/token") ? authPayload(supabaseUser()) : supabaseUser()))));
    const request = new NextRequest("http://localhost:3000/bookings", { headers: { cookie: `pikol-auth=${encoded}` } });
    const response = await updateSession(request);
    expect(response.cookies.getAll().some(cookie => cookie.name.startsWith("pikol-auth") && cookie.httpOnly)).toBe(true);
    expect(request.cookies.get("pikol-auth")?.value).not.toBe(encoded);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("pikol-auth");
  });
  it("passes anonymous requests without creating auth cookies", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3000"));
    expect(response.cookies.getAll()).toHaveLength(0);
  });
  it("clears numbered chunks when a refreshed session becomes smaller", async () => {
    const original = { ...authPayload(supabaseUser({ user_metadata: { profile: "z".repeat(10_000) } })), expires_at: Math.floor(Date.now()/1000)-60 };
    const encoded = `base64-${Buffer.from(JSON.stringify(original)).toString("base64url")}`;
    const chunks = encoded.match(/.{1,2000}/g)!;
    vi.stubGlobal("fetch", vi.fn(async url => new Response(JSON.stringify(String(url).includes("/token") ? authPayload(supabaseUser()) : supabaseUser()))));
    const cookie = chunks.map((value, index) => `pikol-auth.${index}=${value}`).join("; ");
    const request = new NextRequest("http://localhost:3000/bookings", { headers: { cookie } });
    const response = await updateSession(request);
    expect(response.cookies.get("pikol-auth")?.value).toBeTruthy();
    chunks.forEach((_, index) => expect(response.cookies.get(`pikol-auth.${index}`)?.maxAge).toBe(0));
    expect(response.headers.get("x-middleware-request-cookie")).toContain("pikol-auth=");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
