import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    venue: { findMany: async () => { throw new Error("No database connection"); } },
    user: { findUnique: async () => ({ id: "private-admin", email: "admin@example.com", role: "ADMIN", isActive: true }) },
  },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "verified-admin" } }, error: null }) } }),
}));
vi.mock("payload", () => ({
  getPayload: async () => ({ findGlobal: async () => ({ _status: "published", heroTitle: "Edited production headline" }) }),
}));
vi.mock("@/payload.config", () => ({ default: {} }));

import { listCities, featuredVenues } from "@/lib/venues";
import { getHomeContent } from "@/cms/content";
import { homeDefaults } from "@/cms/defaults";
import { getSessionFromRequest } from "@/lib/auth/session";
import { requestMagicLink } from "@/lib/auth/magic-link";

beforeEach(() => {
  vi.stubEnv("APP_PREVIEW_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("PAYLOAD_SECRET", "configured-secret");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("public preview without private service connections", () => {
  it("keeps all Philippine city choices when PostgreSQL is unavailable", async () => {
    const cities = await listCities();
    expect(cities).toHaveLength(149);
    expect(cities).toContainEqual(expect.objectContaining({ value: "Davao City" }));
  });

  it("shows no invented featured venues", async () => {
    expect(await featuredVenues()).toEqual([]);
  });

  it("uses default content without consulting private CMS content", async () => {
    expect((await getHomeContent()).heroTitle).toBe(homeDefaults.heroTitle);
  });

  it("does not authorize a previously verified admin session", async () => {
    expect(await getSessionFromRequest(new NextRequest("https://pikol.example"))).toBeNull();
  });

  it("rejects magic-link requests before delivering a link that cannot be completed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(requestMagicLink("player@example.com", { origin: "https://pikol.example" }))
      .rejects.toMatchObject({ httpStatus: 503, code: "preview_unavailable" });
  });
});
