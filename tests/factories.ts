import { randomUUID } from "node:crypto";
import { prisma } from "./db";

function rid(): string {
  return randomUUID().slice(0, 8);
}

export async function seedOwnerVenueCourt(opts?: { priceCents?: number }) {
  const owner = await prisma.user.create({
    data: { email: `owner-${rid()}@t.test`, name: "Owner", role: "OWNER" },
  });
  const venue = await prisma.venue.create({
    data: {
      slug: `venue-${rid()}`,
      name: "Test Venue",
      city: "Davao City",
      status: "APPROVED",
      isPublished: true,
      ownerId: owner.id,
    },
  });
  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: "Court 1",
      priceCents: opts?.priceCents ?? 40000,
    },
  });
  return { ownerId: owner.id, venueId: venue.id, courtId: court.id };
}

/** A future-dated slot on a fixed UTC day, `durationH` hours long. */
export function slot(dayOffset = 3, hour = 19, durationH = 1) {
  const startsAt = new Date();
  startsAt.setUTCHours(0, 0, 0, 0);
  startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
  startsAt.setUTCHours(hour);
  const endsAt = new Date(startsAt);
  endsAt.setUTCHours(hour + durationH);
  return { startsAt, endsAt };
}

/** Convenience for the required booking tests: a seeded court + one slot. */
export async function seedOneCourtSlot(opts?: { priceCents?: number }) {
  const base = await seedOwnerVenueCourt(opts);
  return { ...base, ...slot(), priceCents: opts?.priceCents ?? 40000 };
}
