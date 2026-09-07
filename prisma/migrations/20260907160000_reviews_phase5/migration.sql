-- Phase 5: reviews get updatedAt, a rating range check, and a composite index
-- for recent-reviews ordering. bookingId stays nullable+unique (seed reviews
-- are null; the unique index still enforces one review per real booking).
ALTER TABLE "reviews" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

DROP INDEX IF EXISTS "reviews_venueId_idx";
CREATE INDEX "reviews_venueId_createdAt_idx" ON "reviews" ("venueId", "createdAt");
