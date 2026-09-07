# RallyPoint — Thin-Slice Design Spec

**Date:** 2026-09-07
**Status:** Approved (with amendments, folded in below)
**Scope:** One end-to-end vertical slice of RallyPoint, a web-only "Airbnb for pickleball" marketplace.

---

## 0. Source & decisions

Derived from `pickleball-aggregator-spec.md` and the RallyPoint MASTER BUILD PROMPT. Where those two conflicted, the following decisions govern:

| Decision | Choice |
|---|---|
| Where booking truth lives | **RallyPoint owns booking truth.** Sentry is an optional per-venue connector behind a seam, not implemented this slice. |
| This build cycle | **End-to-end thin slice** proving DISCOVER → COMPARE → RESERVE → PAY(proof) → CONFIRM. |
| Stack | Next.js 16 (App Router) + TypeScript + Prisma + **PostgreSQL 16 from day one** (docker-compose) + Tailwind 4 + Radix + lucide. |
| Auth | Magic-link, **dev-surfaced** (link printed to server console + dev-only banner); pluggable `EmailSender`. |
| Postgres | `docker-compose.yml` I provide; `docker compose up -d`. |
| Brand | RallyPoint. |

## 1. What this slice proves (and what it doesn't)

**Proves, on real Postgres with automated tests:** player searches Davao → opens a venue → picks court + time + duration → server creates a `HELD` reservation with a live, server-authoritative countdown → submits payment proof → owner reviews proof → owner confirms → `CONFIRMED`. Double-booking is prevented **at the database**, not just the UI.

**Seeded, not built as UI this cycle:** admin user; one owner tied to a venue for the confirm side; 3–5 Davao venues (photos/amenities/courts/schedules/payment methods); a demo customer.

**Explicitly deferred (data model stays ready):** owner onboarding wizard, admin verification/approval UI, favorites, review-writing, notification delivery, owner calendar, walk-ins & court-blocking UI, staff-invite UI, interactive map, the Sentry connector implementation, real email provider, SEO beyond basics.

## 2. Architecture

```
Browser (RSC + minimal client JS)
   → Next.js route handlers / server actions
      → service layer: BookingEngine · AvailabilityEngine · Auth
         → Prisma → PostgreSQL 16
```

Secrets never reach the browser. Three seams isolate replaceable concerns:

- **`BookingBackend`** — wraps all occupancy operations (check availability, create hold, transition). A **`LocalBookingBackend`** is authoritative now. A future `SentryBookingBackend` must preserve this interface while respecting Sentry's authoritative semantics for connected venues. Not implemented this slice.
- **`PaymentProofStorage`** — `save(file) → key` / `getUrl(key)` / `getStream(key)`. `LocalFsStorage` (writes to `uploads/`) now; swappable for object storage (e.g. S3/R2) in prod. No caller changes.
- **`EmailSender`** — `sendMagicLink(email, url)`. `DevConsoleSender` (logs + dev banner) now; Resend/SMTP later.

## 3. Data model (Prisma / Postgres)

Entities: `User · Venue · VenueStaff · Court · CourtSchedule · ScheduleException · Booking · PaymentSubmission · PaymentMethod · Review · Favorite · Notification · VenueVerification · SentryConnection · BookingStatusHistory · MagicLinkToken`.

Keep the model as-is unless implementation reveals a concrete problem.

**Deviation #1 — no separate `BookingHold` table.** A hold **is** a `Booking` with `status = HELD` and a `holdExpiresAt` timestamp. One unified occupancy model so online bookings, holds, and (future) walk-ins share one source of truth (per prompt §30/§31). The suggested `BookingHold` entity from §40 is intentionally folded into `Booking`.

Key fields:
- `Booking`: `id`, `reference` (`RP-XXXXX`), `userId?`, `venueId`, `courtId`, `startsAt`, `endsAt`, `period` (Postgres `tstzrange`, generated/maintained from starts/ends), `status`, `holdExpiresAt?`, `priceTotal`, `currency`, `idempotencyKey?` (unique), customer snapshot (`name`, `mobile`, `email`), timestamps.
- `PaymentSubmission`: `bookingId`, `paymentMethodId?`, `reference`, `proofKey` (storage key), `amount`, `submittedAt`.
- `BookingStatusHistory`: `bookingId`, `from?`, `to`, `at`, `actor` (system/customer/owner), `note?`.

## 4. Booking state machine (server-authoritative)

```
HELD → PENDING_PAYMENT → PAYMENT_SUBMITTED → PENDING_CONFIRMATION → CONFIRMED
```
Terminal: `EXPIRED · CANCELLED · REJECTED · COMPLETED`.

- A transition table validates every change **server-side**; clients call intent endpoints (`hold`, `submitPayment`, `confirm`, `reject`, `cancel`), never a raw status setter.
- Every transition appends a `BookingStatusHistory` row (§41 audit).
- Illegal transitions are rejected with a clear error and never mutate state.

## 5. Double-booking protection (DB-level guarantee)

**Deviation #2 — a real database guarantee, layered with app logic.**

- Enable `btree_gist`. Add a Postgres **`EXCLUDE` constraint** forbidding overlapping `period` on the same `court_id` among **occupying** statuses.
- **Occupying statuses** (must remain protected by the constraint): `HELD`, `PENDING_PAYMENT`, `PAYMENT_SUBMITTED`, `PENDING_CONFIRMATION`, `CONFIRMED`.
- **Non-occupying (free the slot):** `EXPIRED`, `CANCELLED`, `REJECTED`, `COMPLETED` (COMPLETED is historical/past-dated).
- Because a constraint can't call `now()`, hold expiry is an explicit **state flip**: creating a hold runs in a transaction that first expires stale `HELD` rows on that court/range (`holdExpiresAt < now()` → `EXPIRED`), then inserts. A periodic sweeper also flips expired holds for cleanliness. Availability reads treat expired-but-unswept holds as free.
- **Transactions:** use **normal (READ COMMITTED) transactions by default.** Explicitly handle:
  - `exclusion_violation (23P01)` → map to `409 "slot just taken."`
  - retryable serialization/deadlock failures (`40001`, `40P01`) → bounded retry.
  Do **not** require `SERIALIZABLE` for every booking transaction; use a stricter level only for a specific operation that provably needs it.
- Layered defenses: **idempotency keys** (dedupe retries/double-submits, unique index) + the EXCLUDE constraint + app-level availability check. Never trust the client for availability.

## 6. Availability engine

For `(court, date)`: generate hourly slots from `CourtSchedule` weekday windows, subtract `ScheduleException` (maintenance/closure) and occupying `Booking` rows. Duration = N contiguous hours (default slot 60 min; MVP flat hourly price = hours × rate). A range is bookable only if every covered hour is free **and** inside one operating window. Search fans out over matching Davao venues behind a short-TTL (30–60s) in-memory cache; the multi-venue seam exists and runs over seed venues this cycle.

## 7. Auth

Magic-link: single-use, short-TTL, **hashed** tokens in `MagicLinkToken`; session = signed `jose` JWT httpOnly cookie. Roles `CUSTOMER · OWNER · STAFF · ADMIN`, enforced server-side with ownership checks (an owner may only act on their own venue's bookings). Dev `EmailSender` prints the link to the server console and a dev-only banner.

## 8. Player UI (this cycle)

Magic-link login · Homepage ("Find your next game" hero + search: city, date, time window, duration + featured venue cards) · Search results (venue cards: photo, rating, location, court count, price-from, next-free chips; **List only — no Map, no dead toggle**) · Venue page (hero gallery, verified badge, amenities, courts, per-court slot grid, hours, rules, address, reviews, sticky booking panel) · Booking flow (select → details → hold + countdown → payment step: venue GCash/Maya + amount + reference + screenshot upload → status) · Booking detail/status page (permanent, by `RP-XXXXX`, live status + history) · My bookings (upcoming/past, resume unpaid holds).

## 9. Owner UI (this cycle — confirm side only)

Login (role OWNER) · Incoming reservations list (filter by status) · Booking detail with **payment-proof viewer** + **Confirm → CONFIRMED / Reject → REJECTED** (both write audit history). Dashboard, calendar, onboarding wizard, walk-ins, blocking UI, staff UI, admin verification UI are **deferred**.

## 10. Design system

Build only the components the slice uses: Button, Input, Select, SearchBar, DatePicker, TimeSlot/SlotGrid, VenueCard, CourtCard, BookingSummary, BookingStatus badge, PaymentCard, Modal/BottomSheet, Toast, EmptyState/ErrorState/Skeleton. Mobile-first; emerald/deep-green primary, lime accent, charcoal text, rounded cards, restrained shadows.

## 11. Uploads

Payment screenshot via `PaymentProofStorage` (local FS in dev) with type (jpg/png/webp) + size (≤5 MB) validation; served only through an authorized route (booking's customer, its venue owner/staff, or admin).

## 12. Testing (Vitest + real test Postgres)

Critical path only (prompt §56). **Required named tests:**
1. Concurrent booking attempts on the same slot → **exactly one succeeds**.
2. **Idempotent retry** returns the same booking, creates no duplicate.
3. **Expired hold becomes available again.**
4. **Payment-pending booking still blocks the slot** (`PENDING_PAYMENT` / `PAYMENT_SUBMITTED` / `PENDING_CONFIRMATION` occupy).
5. **Owner cannot confirm a booking belonging to another venue.**

Plus: state-machine legal/illegal transitions; availability (window, maintenance, held/booked subtraction, duration spanning, boundaries); upload type/size validation; cross-user booking-access denial. Concurrency/EXCLUDE tests run against Postgres (not SQLite). One optional Playwright happy-path e2e.

## 13. Project & ops

Fresh Next.js 16 + TS in `d:\PRJ-3\pickle` (heed `AGENTS.md`: Next 16 has real breaking changes — consult its bundled docs before coding) · `docker-compose.yml` (Postgres 16) · Prisma migration enabling `btree_gist` + the EXCLUDE constraint · seed script (admin, 1 owner, 3–5 Davao venues, courts, schedules, payment methods, demo customer, a couple reviews) · `.env.example`.

## 14. Verification gate (Definition of Done for the slice)

Do **not** proceed past this gate with failures:
- End-to-end player → owner-confirm journey works on real data.
- Double-booking provably prevented under concurrency (test 1 green).
- All five required named tests green.
- `typecheck` + `lint` + full production `build` all pass.

## 15. Deliberate deviations from literal spec text (for the record)

1. Hold modeled as `Booking(status=HELD)` — no `BookingHold` table (unifies occupancy).
2. DB-level `EXCLUDE` constraint as the primary double-booking guarantee (vs app-only checks).
3. Search ships List-only this cycle; Map deferred with **no** dead toggle.
4. Owner side is confirm-only this cycle; dashboard/calendar/onboarding/walk-ins/blocking/staff/admin-verification deferred.
5. Normal READ COMMITTED transactions with explicit `23P01` + retryable-failure handling, not blanket `SERIALIZABLE`.
