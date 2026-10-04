import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { ownerDestination } from "@/lib/auth/owner-security";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

const state = vi.hoisted(() => ({ session: vi.fn(), path: "/owner/venues/one/details?tab=location" }));
vi.mock("@/lib/auth/session", () => ({ getSignInSession: state.session }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-pikol-path": state.path }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); } }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: async (req: NextRequest) => NextResponse.json({ path: req.headers.get("x-pikol-path") }) }));

beforeEach(() => { state.path = "/owner/venues/one/details?tab=location"; state.session.mockReset(); });

describe("owner sign-in routing", () => {
  it("keeps the exact venue destination for an unauthenticated visit", async () => {
    state.session.mockResolvedValue(null);
    await expect(getOwnerPageSession()).rejects.toThrow("redirect:/owner/login?next=" + encodeURIComponent(state.path));
  });
  it("routes first-factor owners to verification without loading venue data", async () => {
    state.session.mockResolvedValue({ id: "owner", role: "OWNER", mfaVerified: false });
    await expect(getOwnerPageSession()).rejects.toThrow("redirect:/owner/verify?next=" + encodeURIComponent(state.path));
  });
  it("sends players through venue onboarding rather than granting a role", async () => {
    state.session.mockResolvedValue({ id: "customer", role: "CUSTOMER", mfaVerified: false });
    await expect(getOwnerPageSession()).rejects.toThrow("redirect:/list-your-venue");
  });
  it("returns a verified workspace identity", async () => {
    const owner = { id: "owner", role: "OWNER", mfaVerified: true };
    state.session.mockResolvedValue(owner);
    expect(await getOwnerPageSession()).toEqual(owner);
  });
  it.each(["/owner/verify", "/owner/login", "/login", "/signup", "/auth/verify", "//elsewhere.test", "/%2felsewhere.test"])("prevents authentication loops and unsafe destination %s", path => {
    expect(ownerDestination(path)).toBe("/owner");
  });
  it("overrides a client-supplied return-path header in the proxy", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/owner/venues/one/details?tab=location", { headers: { "x-pikol-path": "/elsewhere" } }));
    expect(await response.json()).toEqual({ path: state.path });
  });
});
