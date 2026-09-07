import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking } from "../factories";
import { createReview } from "@/lib/review/service";
import { ConflictError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("duplicate protection", () => {
  it("rejects a second review for the same booking (service)", async () => {
    const { customerId, bookingId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5 });
    await expect(
      createReview({ bookingId, userId: customerId, rating: 3 }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.review.count({ where: { bookingId } })).toBe(1);
  });

  it("enforces one review per booking at the database (unique index)", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 5 } });
    await expect(
      prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 1 } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
