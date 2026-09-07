-- Phase 6: mark which backend owns a booking, and store Sentry external refs.
CREATE TYPE "BackendType" AS ENUM ('LOCAL', 'SENTRY');

ALTER TABLE "bookings" ADD COLUMN "backendType" "BackendType" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "bookings" ADD COLUMN "externalRef" TEXT;
CREATE INDEX "bookings_backendType_idx" ON "bookings" ("backendType");

ALTER TABLE "courts" ADD COLUMN "externalRef" TEXT;
