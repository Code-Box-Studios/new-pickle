import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalReq, getPayload, type Payload } from "payload";
import config from "@/payload.config";
import { homeDefaults } from "@/cms/defaults";
import { seedContent } from "@/cms/seed";
import prisma from "@/lib/prisma";
import { sql } from "@payloadcms/db-postgres";
import { getHomeContent } from "@/cms/content";
import { up as renameBrand, down as restoreBrand } from "@/cms/migrations/20261002_134500_pikol_brand";
vi.mock("server-only", () => ({}));
// The local Payload API runs outside Next's request/cache runtime. Keep these
// integration checks on real database content; cache.test.ts covers actual Next
// persistence and invalidation separately.
vi.mock("next/cache", () => ({
  unstable_cache: (read: (...args: unknown[]) => Promise<unknown>) => read,
  revalidateTag: () => {},
}));

const identities = vi.hoisted(() => new Map<string, { id: string }>());
vi.mock("@supabase/ssr", async importOriginal => {
  const original = await importOriginal<typeof import("@supabase/ssr")>();
  return { ...original, createServerClient: (_url: string, _key: string, options: { cookies: { getAll(): { name: string; value: string }[] } }) => ({ auth: { getUser: async () => ({ data: { user: identities.get(options.cookies.getAll().find(cookie => cookie.name === "pikol-test-session")?.value ?? "") ?? null }, error: null }) } }) };
});
let payload: Payload;
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  payload = await getPayload({ config });
});
afterAll(async () => {
  await payload?.destroy();
  vi.unstubAllEnvs();
});
describe("published CMS content", () => {
  it("keeps drafts private until published", async () => {
    await payload.updateGlobal({
      slug: "homepage",
      data: { ...homeDefaults, heroTitle: "Published headline" },
      draft: false,
    });
    await payload.updateGlobal({
      slug: "homepage",
      data: { heroTitle: "Draft headline" },
      draft: true,
    });
    expect(
      (await payload.findGlobal({ slug: "homepage", draft: false })).heroTitle,
    ).toBe("Published headline");
    expect(
      (await payload.findGlobal({ slug: "homepage", draft: true })).heroTitle,
    ).toBe("Draft headline");
    await payload.updateGlobal({
      slug: "homepage",
      data: { heroTitle: "Draft headline" },
      draft: false,
    });
    expect(
      (await payload.findGlobal({ slug: "homepage", draft: false })).heroTitle,
    ).toBe("Draft headline");
  });
  it("denies anonymous content reads and writes", async () => {
    await expect(
      payload.findGlobal({ slug: "homepage", overrideAccess: false }),
    ).rejects.toThrow();
    await expect(
      payload.updateGlobal({
        slug: "homepage",
        data: { heroTitle: "Unauthorized" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });
  it("denies anonymous CMS registration", async () => {
    await expect(
      payload.create({
        collection: "cms-users",
        data: { email: "intruder@example.com", externalUserId: "forged" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });
  it("preserves published edits when seeding again", async () => {
    await payload.updateGlobal({
      slug: "homepage",
      data: { heroTitle: "Keep this edit" },
      draft: false,
    });
    await seedContent(payload);
    await seedContent(payload);
    expect(
      (await payload.findGlobal({ slug: "homepage", draft: false })).heroTitle,
    ).toBe("Keep this edit");
  });
  it("does not show unpublished draft content on the public website", async () => {
    await payload.updateGlobal({
      slug: "homepage",
      data: { ...homeDefaults, heroTitle: "Published", _status: "published" },
      draft: false,
    });
    await payload.updateGlobal({
      slug: "homepage",
      data: { heroTitle: "Private draft" },
      draft: true,
    });
    await payload.updateGlobal({
      slug: "homepage",
      data: { _status: "draft" },
      draft: false,
    });
    expect((await getHomeContent()).heroTitle).toBe(homeDefaults.heroTitle);
  });
  it("preserves the first saved draft before any publication", async () => {
    // Only the dedicated test database is used here (tests/setup.ts).
    await payload.db.drizzle.execute(
      sql`DELETE FROM "cms"."homepage"; DELETE FROM "cms"."_homepage_v";`,
    );
    await payload.updateGlobal({
      slug: "homepage",
      data: { ...homeDefaults, heroTitle: "First private draft" },
      draft: true,
    });
    await seedContent(payload);
    expect(
      (await payload.findGlobal({ slug: "homepage", draft: true })).heroTitle,
    ).toBe("First private draft");
    expect((await getHomeContent()).heroTitle).toBe(homeDefaults.heroTitle);
  });
  it("links an existing admin and denies access after their role is revoked", async () => {
    const admin = await prisma.user.create({
      data: { email: "cms-strategy-test@rallypoint.test", role: "ADMIN", supabaseId: "verified-strategy-admin" },
    });
    identities.set("verified-strategy-admin", { id: "verified-strategy-admin" });
    try {
      const headers = new Headers({
        cookie: "pikol-test-session=verified-strategy-admin",
      });
      const { user } = await payload.auth({ headers });
      expect(user?.collection).toBe("cms-users");
      expect(user?.externalUserId).toBe(admin.id);
      expect(
        await payload.findGlobal({
          slug: "homepage",
          user,
          overrideAccess: false,
        }),
      ).toHaveProperty("heroTitle");
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: "CUSTOMER" },
      });
      expect((await payload.auth({ headers })).user).toBeNull();
      await expect(
        payload.findGlobal({ slug: "homepage", user, overrideAccess: false }),
      ).rejects.toThrow();
    } finally {
      await payload.delete({
        collection: "cms-users",
        where: { externalUserId: { equals: admin.id } },
      });
      await prisma.user.delete({ where: { id: admin.id } });
    }
  });

  it("renames CMS copy and versions while preserving edits, links, and private drafts", async () => {
    await payload.updateGlobal({
      slug: "homepage",
      data: { ...homeDefaults, heroTitle: "Keep my headline", stepsDescription: "My custom RallyPoint message", primaryHref: "/search?source=RallyPoint", _status: "published" },
      draft: false,
    });
    await payload.updateGlobal({
      slug: "homepage",
      data: { heroTitle: "Private RallyPoint headline", _status: "draft" },
      draft: true,
    });
    const args = { db: payload.db.drizzle, payload, req: await createLocalReq({}, payload) };
    await renameBrand(args);
    const published = await payload.findGlobal({ slug: "homepage", draft: false });
    const draft = await payload.findGlobal({ slug: "homepage", draft: true });
    expect(published.heroTitle).toBe("Keep my headline");
    expect(published.stepsDescription).toBe("My custom Pikol message");
    expect(published.primaryHref).toBe("/search?source=RallyPoint");
    expect(published._status).toBe("published");
    expect(draft.heroTitle).toBe("Private Pikol headline");
    expect(draft._status).toBe("draft");
    const versions = await payload.findGlobalVersions({ slug: "homepage", limit: 100 });
    expect(versions.docs.some(doc => doc.version.heroTitle === "Private Pikol headline")).toBe(true);
    expect(versions.docs.every(doc => !doc.version.heroTitle?.includes("RallyPoint") && !doc.version.stepsDescription?.includes("RallyPoint"))).toBe(true);
    try {
      await restoreBrand(args);
      expect((await payload.findGlobal({ slug: "homepage", draft: true })).heroTitle).toBe("Private RallyPoint headline");
    } finally {
      await renameBrand(args);
    }
  });
});
