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

export async function seedCustomer() {
  return prisma.user.create({
    data: { email: `c-${rid()}@t.test`, name: "Casey Customer", role: "CUSTOMER" },
  });
}

/** Owner+venue+court+customer + a booking row created directly at a given status. */
async function seedBookingAt(status: "CONFIRMED" | "COMPLETED", opts?: { priceCents?: number }) {
  const base = await seedOwnerVenueCourt(opts);
  const customer = await seedCustomer();
  const s = slot();
  const booking = await prisma.booking.create({
    data: {
      reference: `RP-${rid().toUpperCase()}`,
      venueId: base.venueId,
      courtId: base.courtId,
      userId: customer.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status,
      priceCents: opts?.priceCents ?? 40000,
    },
  });
  return { ...base, customerId: customer.id, bookingId: booking.id, reference: booking.reference };
}

export function seedCompletedBooking(opts?: { priceCents?: number }) {
  return seedBookingAt("COMPLETED", opts);
}

export function seedConfirmedBooking(opts?: { priceCents?: number }) {
  return seedBookingAt("CONFIRMED", opts);
}

/** A CONNECTED Sentry venue: court carries an externalRef, connection is CONNECTED. */
export async function seedSentryVenue(opts?: { resourceRef?: string; priceCents?: number }) {
  const resourceRef = opts?.resourceRef ?? "r1";
  const base = await seedOwnerVenueCourt(opts);
  await prisma.court.update({ where: { id: base.courtId }, data: { externalRef: resourceRef } });
  await prisma.sentryConnection.create({
    data: { venueId: base.venueId, sentryBusinessRef: "biz-1", connectionState: "CONNECTED" },
  });
  const customer = await prisma.user.create({
    data: { email: `c-${rid()}@t.test`, role: "CUSTOMER" },
  });
  return { ...base, resourceRef, customerId: customer.id };
}
