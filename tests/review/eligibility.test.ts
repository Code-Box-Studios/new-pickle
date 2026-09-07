import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedConfirmedBooking, seedCustomer } from "../factories";
import { reviewEligibility } from "@/lib/review/eligibility";

beforeEach(resetDb);

describe("reviewEligibility", () => {
  it("a completed booking owned by the user is eligible", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: true, venueId, existingReview: null });
  });

  it("a non-completed booking is not eligible", async () => {
    const { customerId, bookingId } = await seedConfirmedBooking();
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_COMPLETED" });
  });

  it("a booking owned by someone else is not eligible", async () => {
    const { bookingId } = await seedCompletedBooking();
    const other = await seedCustomer();
    const r = await reviewEligibility(bookingId, other.id);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_OWNER" });
  });

  it("an already-reviewed booking is not eligible", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 5 } });
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: false, reason: "ALREADY_REVIEWED" });
    expect(r.existingReview?.rating).toBe(5);
  });

  it("a missing booking is not eligible", async () => {
    const other = await seedCustomer();
    const r = await reviewEligibility("nope", other.id);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_FOUND" });
  });
});
