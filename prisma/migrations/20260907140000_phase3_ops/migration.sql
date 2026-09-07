-- Phase 3 owner operations: walk-in note + venue-scoped schedule exceptions.

-- Operational note (used by walk-ins: payment method + free text).
ALTER TABLE "bookings" ADD COLUMN "note" TEXT;

-- Schedule exceptions become venue-scoped; courtId nullable => venue-wide block.
ALTER TABLE "schedule_exceptions" ADD COLUMN "venueId" TEXT;
UPDATE "schedule_exceptions" se
  SET "venueId" = c."venueId"
  FROM "courts" c
  WHERE se."courtId" = c."id";
ALTER TABLE "schedule_exceptions" ALTER COLUMN "venueId" SET NOT NULL;
ALTER TABLE "schedule_exceptions" ALTER COLUMN "courtId" DROP NOT NULL;
ALTER TABLE "schedule_exceptions"
  ADD CONSTRAINT "schedule_exceptions_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "schedule_exceptions_venueId_startsAt_idx"
  ON "schedule_exceptions"("venueId", "startsAt");
