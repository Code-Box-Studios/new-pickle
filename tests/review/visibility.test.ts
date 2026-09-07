import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking } from "../factories";
import { createReview, listVenueReviews } from "@/lib/review";
import { featuredVenues } from "@/lib/venues";

beforeEach(resetDb);

describe("marketplace visibility of reviews", () => {
  it("a published venue's rating flows into venue card data", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5, body: "Superb" });

    const cards = await featuredVenues(10);
    const card = cards.find((c) => c.ratingCount > 0);
    expect(card).toBeDefined();
    expect(card!.ratingAvg).toBe(5);
    expect(card!.ratingCount).toBe(1);

    const reviews = await listVenueReviews(venueId);
    expect(reviews[0].body).toBe("Superb");
    // Author name is a display name, never the raw email.
    expect(reviews[0].authorName).not.toContain("@");
  });

  it("an unpublished venue is not returned by the public featured query", async () => {
    const { venueId, customerId, bookingId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5 });
    await prisma.venue.update({ where: { id: venueId }, data: { isPublished: false } });

    const cards = await featuredVenues(10);
    expect(cards.find((c) => c.ratingCount > 0)).toBeUndefined();
  });
});
