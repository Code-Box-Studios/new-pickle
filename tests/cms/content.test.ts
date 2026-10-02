import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "@/payload.config";
import { homeDefaults } from "@/cms/defaults";
import { seedContent } from "@/cms/seed";
import prisma from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { sql } from "@payloadcms/db-postgres";
import { getHomeContent } from "@/cms/content";
vi.mock("server-only", () => ({}));

let payload: Payload;
beforeAll(async () => {
  payload = await getPayload({ config });
});
afterAll(async () => {
  await payload?.destroy();
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
      data: { email: "cms-strategy-test@rallypoint.test", role: "ADMIN" },
    });
    try {
      const headers = new Headers({
        cookie: `${SESSION_COOKIE}=${await signSession(admin)}`,
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
});
