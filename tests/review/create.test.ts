import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedConfirmedBooking } from "../factories";
import { createReview } from "@/lib/review/service";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("createReview", () => {
  it("accepts a valid rating and stores venueId derived from the booking", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    const r = await createReview({ bookingId, userId: customerId, rating: 5, body: "Great courts" });
    expect(r.rating).toBe(5);
    const row = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.venueId).toBe(venueId);
    expect(row.bookingId).toBe(bookingId);
  });

  it("stores an empty/whitespace comment as null", async () => {
    const { customerId, bookingId } = await seedCompletedBooking();
    const r = await createReview({ bookingId, userId: customerId, rating: 4, body: "   " });
    expect(r.body).toBeNull();
  });

  it.each([0, 6, 2.5, -1])("rejects invalid rating %s", async (bad) => {
    const { customerId, bookingId } = await seedCompletedBooking();
    await expect(
      createReview({ bookingId, userId: customerId, rating: bad as number }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a review on a non-completed booking", async () => {
    const { customerId, bookingId } = await seedConfirmedBooking();
    await expect(
      createReview({ bookingId, userId: customerId, rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a review by a non-owner", async () => {
    const { bookingId } = await seedCompletedBooking();
    await expect(
      createReview({ bookingId, userId: "someone-else", rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
