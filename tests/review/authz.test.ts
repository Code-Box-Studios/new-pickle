import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedCompletedBooking, seedCustomer } from "../factories";
import { createReview, updateReview, listReviewsForVenues } from "@/lib/review";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { ForbiddenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("review authorization", () => {
  it("a customer cannot edit another customer's review (via that booking id)", async () => {
    const { customerId, bookingId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5, body: "mine" });
    const attacker = await seedCustomer();
    await expect(
      updateReview({ bookingId, userId: attacker.id, rating: 1, body: "hacked" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("owner listing is scoped to venues they manage", async () => {
    const A = await seedCompletedBooking();
    const B = await seedCompletedBooking();
    await createReview({ bookingId: A.bookingId, userId: A.customerId, rating: 5 });
    await createReview({ bookingId: B.bookingId, userId: B.customerId, rating: 3 });

    const ownerAIds = await accessibleVenueIds(A.ownerId, "OWNER");
    const visible = await listReviewsForVenues(ownerAIds);
    expect(visible).toHaveLength(1);
    expect(visible[0].venueId).toBe(A.venueId);
  });
});
