import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedCustomer } from "../factories";
import { createReview, venueRatingSummary } from "@/lib/review/service";

beforeEach(resetDb);

// Add a second completed booking on the SAME venue for a second reviewer.
async function secondCompletedBookingFor(venueId: string, courtId: string) {
  const customer = await seedCustomer();
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + 5);
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  const b = await prisma.booking.create({
    data: {
      reference: `RP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      venueId,
      courtId,
      userId: customer.id,
      startsAt,
      endsAt,
      status: "COMPLETED",
      priceCents: 40000,
    },
  });
  return { customerId: customer.id, bookingId: b.id };
}

describe("rating aggregates", () => {
  it("updates venue ratingAvg and ratingCount on create", async () => {
    const { customerId, bookingId, venueId, courtId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5 });
    const second = await secondCompletedBookingFor(venueId, courtId);
    await createReview({ bookingId: second.bookingId, userId: second.customerId, rating: 4 });

    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue.ratingCount).toBe(2);
    expect(venue.ratingAvg).toBe(4.5);

    const summary = await venueRatingSummary(venueId);
    expect(summary).toMatchObject({ count: 2, avg: 4.5 });
    expect(summary.distribution[5]).toBe(1);
    expect(summary.distribution[4]).toBe(1);
  });
});
