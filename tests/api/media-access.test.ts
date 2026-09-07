import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { canViewVenueMedia, venueForMediaKey } from "@/lib/venue/media-access";
import type { SessionUser } from "@/lib/auth/session";

beforeEach(resetDb);

async function makeVenue(status: "APPROVED" | "DRAFT", isPublished: boolean, key: string) {
  const owner = await prisma.user.create({
    data: { email: `o-${randomUUID().slice(0, 8)}@t.test`, role: "OWNER" },
  });
  const venue = await prisma.venue.create({
    data: {
      slug: `v-${randomUUID().slice(0, 8)}`,
      name: "V",
      city: "Davao City",
      status,
      isPublished,
      ownerId: owner.id,
      photos: [`/api/media/${key}`],
    },
  });
  return { owner, venue };
}

const asSession = (id: string, role: SessionUser["role"]): SessionUser => ({
  id,
  email: "x@t.test",
  role,
});

describe("venue media access", () => {
  it("resolves the owning venue from a media key", async () => {
    const key = "venue-media/abc.png";
    const { venue } = await makeVenue("APPROVED", true, key);
    const found = await venueForMediaKey(key);
    expect(found?.id).toBe(venue.id);
    expect(await venueForMediaKey("venue-media/nope.png")).toBeNull();
  });

  it("published venue media is public", async () => {
    const { venue } = await makeVenue("APPROVED", true, "venue-media/p.png");
    expect(await canViewVenueMedia(venue, null)).toBe(true);
  });

  it("unpublished venue media is owner/admin only", async () => {
    const { owner, venue } = await makeVenue("DRAFT", false, "venue-media/d.png");
    const stranger = await prisma.user.create({
      data: { email: `s-${randomUUID().slice(0, 8)}@t.test` },
    });
    expect(await canViewVenueMedia(venue, null)).toBe(false);
    expect(await canViewVenueMedia(venue, asSession(stranger.id, "CUSTOMER"))).toBe(false);
    expect(await canViewVenueMedia(venue, asSession(owner.id, "OWNER"))).toBe(true);
    expect(await canViewVenueMedia(venue, asSession(stranger.id, "ADMIN"))).toBe(true);
  });
});
