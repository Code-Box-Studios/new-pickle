# RallyPoint — Phase 5: Reviews & Ratings — Design Spec

**Date:** 2026-09-07
**Status:** Approved (final decisions folded in below)
**Branch:** `build/owner-onboarding` (continues the Phase 2–4 stack; commit locally, **do not push**)
**Scope:** A trusted, booking-gated venue review system that improves discovery and venue pages.

---

## 0. Goal

Give players a trusted way to rate a venue **after they actually play**, and surface those
ratings on venue pages and marketplace cards. Trust comes from one hard rule: a review can only
exist for a **completed booking the reviewer owns**, and at most **one review per booking**.

## 1. What the codebase already provides (do not rebuild)

Inspection before design revealed most of the read/display surface already exists — Phase 5 mostly
supplies *real data* and the *write path*:

- **`Review` model already exists**: `id, venueId, userId, bookingId String? @unique, rating Int, body String?, ownerReply String?, createdAt`. The `bookingId @unique` index is the one-review-per-booking guarantee.
- **`Venue.ratingAvg Float` + `ratingCount Int` already exist** and are already consumed by `VenueCard`, `venues.ts#featuredVenues` (sorts by them), the venue detail page, and search. Nothing updates them today (review-writing was deferred).
- **The venue detail page already renders** the aggregate and a "Reviews" section (top 6, reviewer name) — it just reads static seed data.
- **Seed reviews carry `bookingId = null`** (created directly in `prisma/seed.ts`).
- Booking-scoped route pattern exists (`/api/bookings/[id]/cancel|payment|details`) with `requireOwnBooking`.
- `NotificationService` + `createOnce` dedupe seam exists; `complete()` currently fires no notification.
- `venueMediaStorage` + authz-aware `/api/media/[...key]` exist (relevant only to the deferred photo path).
- Tests exercise **services/guards directly** (Vitest, `tests/db.ts#resetDb`, `tests/factories.ts`); HTTP e2e is run separately against the dev server.

## 2. Final decisions (govern this phase)

| # | Decision |
|---|---|
| 1 | **Keep `bookingId String? @unique`.** Do not rewrite seed reviews. Postgres allows many NULLs under a unique index, so seeded (null-booking) reviews survive while the unique constraint still enforces one review per *real* booking. |
| 2 | **Derive `venueId` exclusively from the server-loaded booking.** Never accept `venueId` from the client. Flow: authenticated user → owned booking → completed booking → derive `booking.venueId` → create/update review. |
| 3 | **Updates stay booking-scoped.** Authenticate → resolve owned booking by `bookingId` → load the review for that booking → verify `review.userId === user.id` → update. **No review-id-based API.** |
| 4 | Add `updatedAt DateTime @updatedAt` and DB CHECK `rating BETWEEN 1 AND 5`. |
| 5 | **Photos deferred.** No `photoKeys`, no review-media endpoints/UI. Model stays extensible. |
| 6 | **Deletion deferred.** Create once + edit own review only. |
| 7 | `ownerReply` stays an unused/extensible field. No owner-reply UI or mutation. |
| 8 | Add deduplicated `REVIEW_INVITE` notification when a booking reaches `COMPLETED`, via existing `NotificationService`/`createOnce`, fired **after** the completion transaction commits. No scheduled reminders, no new architecture. |
| 9 | Preserve all booking/state-machine/concurrency logic. Do not weaken the EXCLUDE constraint. Do not refactor unless required. |
| 10 | Sub-phase order: 5A → 5F (below). |
| 11 | Verification gate unchanged: typecheck 0, lint 0, full Vitest green, prod build green, HTTP e2e passes. |

## 3. Data model changes

Schema (`prisma/schema.prisma`) — `Review`:

```prisma
model Review {
  id         String   @id @default(cuid())
  venueId    String
  venue      Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  bookingId  String?  @unique     // nullable: seed reviews are null; unique enforces 1/real-booking
  rating     Int                  // DB CHECK 1..5 (added in raw migration)
  body       String?
  ownerReply String?              // reserved; no UI this phase
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt  // NEW

  @@index([venueId, createdAt])   // replaces @@index([venueId]); recent-reviews ordering
  @@map("reviews")
}
```

Migration `prisma/migrations/<ts>_reviews_phase5/migration.sql`, applied with **`npm run db:deploy`**
then **`npm run db:generate`** (never `migrate dev` — the tsrange/EXCLUDE raw SQL reports benign drift):

```sql
ALTER TABLE "reviews" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
DROP INDEX IF EXISTS "reviews_venueId_idx";
CREATE INDEX "reviews_venueId_createdAt_idx" ON "reviews" ("venueId", "createdAt");
```

(The `reviews_bookingId_key` unique index already exists from the init migration — unchanged.)

## 4. Service module — `src/lib/review/` (Phase 5A core)

New module mirroring `src/lib/venue/*`. **Client is never trusted; every eligibility check runs
server-side and is re-verified inside the write transaction.** Validation is manual (mirrors existing
routes) throwing `ValidationError`/`ForbiddenError`/`NotFoundError`/`ConflictError`.

- `reviewEligibility(bookingId, userId)` → `{ eligible, reason?, venueId?, existingReview? }` where
  `reason ∈ { NOT_FOUND, NOT_OWNER, NOT_COMPLETED, ALREADY_REVIEWED }`. Pure read; used by UI and writes.
- `createReview({ bookingId, userId, rating, body })`:
  1. Validate `rating` is an integer 1–5; `body` optional, trimmed, empty → `null`, capped (~1000 chars).
  2. `$transaction`: reload booking; assert `booking.userId === userId` (Forbidden), `status === COMPLETED` (Validation/Conflict), no existing review (Conflict).
  3. `review.create` with **`venueId = booking.venueId`** (decision #2). Then `recomputeVenueRating(tx, venueId)`.
  4. Catch Prisma `P2002` on `bookingId` → `ConflictError` (race-safe final guard = DB unique).
- `updateReview({ bookingId, userId, rating, body })` (decision #3): reload owned booking → load review by `bookingId` → assert `review.userId === userId` (Forbidden) → validate → update → recompute. No delete.
- `recomputeVenueRating(tx, venueId)`: `review.aggregate({ _avg: { rating }, _count: true })`, round avg to 1 decimal (matches seed), write `Venue.ratingAvg`/`ratingCount`. Called inside the same tx as every write.
- `venueRatingSummary(venueId)` → `{ avg, count, distribution: Record<1..5, number> }` (via `groupBy`), for the venue page.
- `listVenueReviews(venueId, take = 6)` and `listReviewsForVenues(venueIds, take)`: return only **display name** (`user.name ?? user.email.split("@")[0]`), rating, comment, `createdAt`. **Never** email/mobile.

`src/lib/review/index.ts` re-exports the public surface.

## 5. API — booking-scoped only (Phase 5A)

`src/app/api/bookings/[id]/review/route.ts`:
- `POST` — `requireOwnBooking(id)` → `createReview({ bookingId: id, userId: session.id, rating, body })` → return safe review fields.
- `PATCH` — `requireOwnBooking(id)` → `updateReview(...)`.
- Both parse `{ rating, body }` JSON, respond via `errorResponse`.

Because writes are addressed through the **owned booking id** (never a review id), a user structurally
cannot reference or mutate another customer's review (decisions #2/#3). No new owner/admin API — those
views are server components reading via Prisma.

## 6. Customer UI (Phase 5B)

On `src/app/(site)/bookings/[reference]/page.tsx`, when `status === "COMPLETED"`, load eligibility/existing
review and render a mobile-first client component using existing brand tokens (`brand-*`, `ink`, `rounded-2xl`,
`Button`, `toast`):

- **No review yet** → "How was your experience?" + interactive `StarRating` (1–5, touch + keyboard accessible) + optional comment `textarea` → `POST` → `router.refresh()`.
- **Existing review** → show rating + comment + an **Edit** toggle → `PATCH`.

New components: `src/components/review/StarRating.tsx` (interactive) and `src/components/review/ReviewPrompt.tsx`.
A small read-only `Stars` display is reused by the venue page.

## 7. Venue page + aggregates (Phase 5C)

`src/app/(site)/venues/[slug]/page.tsx`: replace the inline review query with `venueRatingSummary` +
`listVenueReviews`. Show prominent aggregate (already present), review count, recent reviews **with date**
(currently missing), and an optional compact rating-distribution bar. Trust-oriented, clean — **not a feed**.
Only display name + rating + comment + date are exposed. Public/unpublished exposure is already gated by the
page (non-live venues viewable by owner/admin only) and by the public venue query (`isPublished + APPROVED`).

## 8. Owner review view + admin inspection (Phase 5D + moderation safety)

- New read-only page `src/app/(owner)/owner/reviews/page.tsx`: `requireRole("OWNER","STAFF")` +
  `accessibleVenueIds` → reviews for owned venues only, grouped by venue with per-venue aggregate.
  Linked from owner nav. **No replies.**
- **Admin inspection needs no new UI:** `ADMIN` bypasses `requireRole`, and `accessibleVenueIds` returns
  *all* venues for admins, so an admin sees every review through the same page (plus every venue page).
  Satisfies "inspect through the existing admin authorization model" without a moderation center.

## 9. Marketplace integration (Phase 5E)

Largely pre-wired: `VenueCard`, `featuredVenues`, and search already read `ratingAvg`/`ratingCount`. Net work:
confirm the search query in `src/lib/venue/queries.ts` maps rating into `VenueCardData` (adjust if it doesn't),
and rely on the write-path recompute so cards reflect real aggregates. Review data must **not** feed booking
availability (kept entirely separate from the occupancy/EXCLUDE model).

## 10. Notifications (Phase 5A)

- Add `NotificationType.REVIEW_INVITE`.
- Add `notificationService.onCompleted(bookingId)` → `createOnce` an in-app "How was your experience?"
  linking to the booking status page (`/bookings/{reference}`) for the booking's `userId`.
- Fire best-effort via `safeNotify` in `LocalBookingBackend.transition` when `to === "COMPLETED"` — **after**
  the transaction commits. Additive only; the booking state machine is untouched.

## 11. Authorization summary

- **Customer:** may create a review only for an eligible completed booking they own; may edit only their own
  review, addressed via the owned booking. Cannot reference another customer's review.
- **Owner/Staff:** may view reviews for venues they manage (`accessibleVenueIds`); no write access to reviews.
- **Admin:** may inspect all reviews via existing admin authorization; no dedicated moderation tooling.

## 12. Testing (Phase 5F)

New `tests/review/*`, matching the direct-service test style, plus a `seedCompletedBooking()` factory
(owner + venue + court + customer + booking transitioned to `COMPLETED`):

- **Eligibility:** completed → eligible; non-completed → ineligible; another user's booking → ineligible/forbidden; a booking from a different venue cannot target another venue (review's `venueId` is derived from the booking).
- **Duplicate protection:** second `createReview` for same booking → `ConflictError`; direct duplicate insert → DB unique violation.
- **Creation validation:** valid rating accepted; invalid rating (0, 6, 2.5, non-int) rejected; empty/whitespace comment stored as `null` and still valid.
- **Authorization:** customer cannot edit another customer's review (Forbidden); owner listing scoped to owned venues; unauthorized denied.
- **Aggregates:** average correct, count correct after N reviews; venue card data (`featuredVenues`/summary) reflects rating.
- **Marketplace visibility:** published venue's review visible via public query/`listVenueReviews`; unpublished venue not publicly exposed.

**Regression:** all Phase 1–4 tests remain green; no changes to booking state machine, conflict model, or the EXCLUDE constraint.

## 13. Verification gate

All green: `typecheck = 0`, `lint = 0`, full Vitest suite green, production build green. Plus HTTP e2e:

> completed booking → eligible customer submits 5★ → venue rating updates → review appears on venue page →
> review appears on venue card → owner can see it → unauthorized user cannot manipulate it (403) →
> duplicate review rejected (409).

Do not push the branch unless explicitly instructed.

## 14. Sub-phase order

- **5A** — schema migration + `src/lib/review/*` service + `/api/bookings/[id]/review` route + `REVIEW_INVITE` notification.
- **5B** — customer UI (`StarRating`, `ReviewPrompt`) wired into the completed-booking status page.
- **5C** — venue page uses summary + recent reviews (+ date, optional distribution).
- **5D** — owner review view (+ nav link); admin inspection verified.
- **5E** — marketplace card/search rating wiring verified/finished.
- **5F** — tests + responsive polish.

After each sub-phase: run tests, typecheck, lint; verify the affected flow; fix failures before proceeding.

## 15. Explicitly deferred (unchanged from program-wide list)

Sentry connector, interactive map, owner review replies, review moderation dashboard, scheduled review
reminders, advanced review categories, social following, player profiles, tournament reviews, real email
provider, **review photos**, **review deletion**.
