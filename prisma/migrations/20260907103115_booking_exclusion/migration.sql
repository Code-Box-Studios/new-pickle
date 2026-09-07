-- Database-level double-booking guarantee.
--
-- A booking occupies its court for a half-open time range [startsAt, endsAt).
-- We add a generated `period` (tstzrange) column derived from those columns and
-- forbid overlapping periods on the same court among "occupying" statuses via a
-- GiST EXCLUDE constraint. `btree_gist` lets us combine the `=` operator on the
-- text court id with the `&&` (overlaps) operator on the range in one index.
--
-- This is the primary correctness guarantee: two holds/bookings (online OR
-- future walk-in) can never occupy the same court time, regardless of races,
-- retries, or multiple app instances. The app layer adds idempotency keys and
-- maps the resulting `23P01` to a 409.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prisma maps `DateTime` to `timestamp(3)` (no time zone); `tsrange` over those
-- columns is IMMUTABLE (a `tstzrange` cast would depend on the session TimeZone
-- and be rejected). Instants are stored consistently in UTC, so overlap
-- detection is correct.
ALTER TABLE "bookings"
  ADD COLUMN "period" tsrange
  GENERATED ALWAYS AS (tsrange("startsAt", "endsAt", '[)')) STORED;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("courtId" WITH =, "period" WITH &&)
  WHERE (
    "status" IN (
      'HELD',
      'PENDING_PAYMENT',
      'PAYMENT_SUBMITTED',
      'PENDING_CONFIRMATION',
      'CONFIRMED'
    )
  );
