# RallyPoint Phase 3 — Owner Operations (Design + Decisions)

**Date:** 2026-09-07 · **Branch:** `build/owner-onboarding` (continues) · **Status:** Approved, proceeding.

Builds day-to-day venue management on the existing booking engine. The booking
engine, `bookings_no_overlap` EXCLUDE constraint, state machine, auth, and all
existing tests are the baseline and must not be destabilized.

## Decision 1 — Walk-in booking state (REQUIRED, documented before implementation)

Walk-ins are **created directly in `CONFIRMED`** with `source = WALK_IN`,
`holdExpiresAt = null`, and **no `PaymentSubmission`**.

- **No new state.** `CONFIRMED` is a legal *initial* insert state, exactly as
  online bookings insert at `HELD`. The transition table is unchanged; we never
  route walk-ins through the customer payment states (`PENDING_PAYMENT` /
  `PAYMENT_SUBMITTED`).
- **Same resource model.** `CONFIRMED` is an occupying status, so a walk-in
  participates in the same `EXCLUDE` constraint — no second booking system.
- **Subsequent management** uses existing transitions: `CONFIRMED → COMPLETED`
  or `CONFIRMED → CANCELLED`.
- The owner records how the customer paid (Cash/GCash/Maya) + an optional note;
  both are stored in a new `Booking.note` (free text like `Cash · <note>`).
  Walk-ins do not use the proof-upload flow.

## Decision 2 — ScheduleException scope (smallest model change)

Add `venueId String` (+ `Venue.exceptions` relation) to `ScheduleException` and
make `courtId String?` **nullable**:

- `courtId` set → **court-scoped** block.
- `courtId = null` (with `venueId`) → **venue-wide** block (all courts).

Availability subtracts exceptions matching `courtId = thisCourt OR (courtId IS
NULL AND venueId = thisVenue)`. The table is currently empty, so the migration
is additive and backfill-safe. Recurring weekly hours are unchanged (venue-wide,
per Phase 2).

## Decision 3 — Conflict protection model

- **booking ↔ booking:** unchanged — the Postgres `EXCLUDE` constraint is the
  ultimate guarantee. Walk-in creation and reschedule both go through it
  (`23P01 → SlotTakenError → 409`). Reschedule = UPDATE of `startsAt/endsAt`;
  the generated `period` recomputes and the constraint rejects overlaps.
- **block ↔ booking:** enforced at the service layer in both directions.
  Creating a block refuses (explicit `ConflictError`, listing conflicts — no
  silent invalidation) if it overlaps an active future booking; creating any
  booking (online or walk-in) subtracts exceptions, so blocked slots are
  unbookable. Blocks are owner-initiated and low-concurrency; the tiny
  block-vs-booking race window is accepted and documented (bookings never race
  each other — that's the EXCLUDE constraint's job).

## Schema changes

```prisma
model Booking { /* … */ note String? }

model ScheduleException {
  id        String        @id @default(cuid())
  venueId   String
  venue     Venue         @relation(fields: [venueId], references: [id], onDelete: Cascade)
  courtId   String?
  court     Court?        @relation(fields: [courtId], references: [id], onDelete: Cascade)
  startsAt  DateTime
  endsAt    DateTime
  type      ExceptionType @default(MAINTENANCE)
  reason    String?
  createdAt DateTime      @default(now())
  @@index([venueId, startsAt])
  @@index([courtId, startsAt])
}
model Venue { /* … */ exceptions ScheduleException[] }
```

Applied via a hand-authored migration + `db:deploy` (`migrate dev` stays blocked
by the `bookings.period` generated-column drift).

## New backend / service surface

- `bookingBackend.createWalkIn(input)` — insert `CONFIRMED` walk-in (shares the
  overlap-safe insert path + idempotency + `23P01` handling); pre-checks blocks.
- `bookingBackend.reschedule(bookingId, startsAt, endsAt, actor)` — non-terminal
  state + no-exception-overlap checks, UPDATE under EXCLUDE.
- `venue/blocks.ts` — `createBlock` (court or venue-wide; conflict-checked),
  `removeBlock` (future only).
- `venue/ops.ts` — `ownerDaySchedule(venueId, date)` / week view returning, per
  court and slot, a state ∈ {AVAILABLE, HELD, PENDING, CONFIRMED, BLOCKED,
  CLOSED} plus booking refs.
- Owner intent routes: walk-in create; block create/delete; booking
  reschedule/cancel/complete (confirm/reject already exist). All guarded by
  `assertVenueAccess`; state changes go through the existing state machine.

## Booking-management transitions (owner)

`confirm` (PENDING_CONFIRMATION→CONFIRMED, exists), `reject`
(PENDING_CONFIRMATION/PAYMENT_SUBMITTED→REJECTED, exists), `cancel`
(→CANCELLED), `complete` (CONFIRMED→COMPLETED), `reschedule` (time change,
status preserved). All validate ownership + current state + time + overlap +
venue status server-side.

## Calendar UX

Owner day/week calendar shows a court × time grid. Each cell's state uses color
**plus** a label/icon and status text (never color alone): AVAILABLE, HELD,
PENDING (PENDING_PAYMENT/PAYMENT_SUBMITTED/PENDING_CONFIRMATION), CONFIRMED,
BLOCKED, CLOSED. Mobile: horizontally scrollable court/time area, sticky "New
booking" / "Block court", booking detail reachable without desktop-only
interactions. Breakpoints 320–1280+.

## Testing (adds to existing; all prior must stay green)

Calendar mapping; walk-in create/conflict/authorization; walk-in ↔ online
conflict; exceptions (court + venue-wide) make slots unavailable; remove future
exception; block-vs-booking and block-vs-hold conflict; reschedule valid /
conflict / unauthorized; cancel valid / invalid; concurrency (concurrent
walk-ins, walk-in vs online race). Regression: all Phase 1 + 2 tests.

## Out of scope (seams intact)

Sentry connector, map, favorites, reviews, notifications delivery, staff
invitations, advanced analytics, payment gateway, tournaments, leagues, player
matching, complex pricing.
