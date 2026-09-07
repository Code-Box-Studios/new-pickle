import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { promoteToOwner } from "@/lib/auth/promote";
import { uniqueVenueSlug } from "@/lib/venue/slug";

beforeEach(resetDb);

describe("owner promotion + slug", () => {
  it("promotes a CUSTOMER to OWNER (and is a no-op afterwards)", async () => {
    const u = await prisma.user.create({ data: { email: `c-${randomUUID().slice(0, 8)}@t.test` } });
    expect(u.role).toBe("CUSTOMER");

    const first = await promoteToOwner(u.id);
    expect(first).toEqual({ role: "OWNER", promoted: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("OWNER");

    const second = await promoteToOwner(u.id);
    expect(second).toEqual({ role: "OWNER", promoted: false });
  });

  it("does not demote an ADMIN", async () => {
    const a = await prisma.user.create({ data: { email: `a-${randomUUID().slice(0, 8)}@t.test`, role: "ADMIN" } });
    expect(await promoteToOwner(a.id)).toEqual({ role: "ADMIN", promoted: false });
  });

  it("generates unique slugs", async () => {
    const owner = await prisma.user.create({ data: { email: `o-${randomUUID().slice(0, 8)}@t.test`, role: "OWNER" } });
    await prisma.venue.create({
      data: { slug: "rally-court", name: "Rally Court", city: "Davao City", ownerId: owner.id },
    });
    expect(await uniqueVenueSlug("Rally Court")).toBe("rally-court-2");
    // Excluding the venue itself keeps its slug stable.
    const v = await prisma.venue.findFirstOrThrow({ where: { slug: "rally-court" } });
    expect(await uniqueVenueSlug("Rally Court", v.id)).toBe("rally-court");
  });
});
