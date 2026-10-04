import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import {
  seedCompletedBooking,
  seedOwnerVenueCourt,
  seedSentryVenue,
} from "../factories";
import { createReview, listVenueReviews } from "@/lib/review";
import { featuredVenues } from "@/lib/venues";

beforeEach(resetDb);

describe("marketplace visibility of reviews", () => {
  it("advertises the actual minimum time rate on featured venue cards", async () => {
    const { courtId, venueId } = await seedOwnerVenueCourt({
      priceCents: 10000,
    });
    await prisma.court.update({
      where: { id: courtId },
      data: {
        timeRates: [
          {
            period: "midnight",
            startMinute: 0,
            endMinute: 360,
            priceCents: 20000,
          },
          {
            period: "morning",
            startMinute: 360,
            endMinute: 720,
            priceCents: 30000,
          },
          {
            period: "afternoon",
            startMinute: 720,
            endMinute: 1020,
            priceCents: 40000,
          },
          {
            period: "evening",
            startMinute: 1020,
            endMinute: 1440,
            priceCents: 50000,
          },
        ],
      },
    });
    const venue = await prisma.venue.findUniqueOrThrow({
      where: { id: venueId },
    });
    const cards = await featuredVenues(10);
    expect(cards.find((c) => c.slug === venue.slug)?.priceFromCents).toBe(
      20000,
    );
  });

  it("keeps synced Sentry rates on featured cards even if older local bands remain saved", async () => {
    const { courtId, venueId } = await seedSentryVenue({ priceCents: 40000 });
    await prisma.court.update({
      where: { id: courtId },
      data: {
        timeRates: [
          {
            period: "midnight",
            startMinute: 0,
            endMinute: 1440,
            priceCents: 20000,
          },
        ],
      },
    });
    const venue = await prisma.venue.findUniqueOrThrow({
      where: { id: venueId },
    });
    const cards = await featuredVenues(10);
    expect(cards.find((c) => c.slug === venue.slug)?.priceFromCents).toBe(
      40000,
    );
  });

  it("a published venue's rating flows into venue card data", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await createReview({
      bookingId,
      userId: customerId,
      rating: 5,
      body: "Superb",
    });

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
    await prisma.venue.update({
      where: { id: venueId },
      data: { isPublished: false },
    });

    const cards = await featuredVenues(10);
    expect(cards.find((c) => c.ratingCount > 0)).toBeUndefined();
  });
});
