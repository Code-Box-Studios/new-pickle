# Phase 5 — Reviews & Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer review a venue exactly once after a booking they own reaches `COMPLETED`, and surface those ratings on the venue page, marketplace cards, and an owner view.

**Architecture:** A new server-only `src/lib/review/` service owns eligibility + create/edit + aggregate recompute; all eligibility is re-verified inside the write transaction and the review's `venueId` is derived from the server-loaded booking. Writes are addressed through a booking-scoped route (`/api/bookings/[id]/review`), never a review id, so a user cannot reference another customer's review. Denormalized `Venue.ratingAvg`/`ratingCount` (already displayed everywhere) are recomputed on every write; a deduped `REVIEW_INVITE` notification fires after the completion transaction commits.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Prisma 5.22, PostgreSQL 16, Vitest 5, Tailwind 4, Radix, lucide-react 1.x.

## Global Constraints

- Prisma pinned to **5.22**; apply migrations with **`npm run db:deploy`** then **`npm run db:generate`** — never `prisma migrate dev` (the `bookings.period` generated column + `bookings_no_overlap` EXCLUDE constraint live in raw SQL and make `migrate dev` report benign drift).
- Postgres runs on host port **55432** (`.env` `DATABASE_URL` already points at `127.0.0.1:55432`).
- **Keep `Review.bookingId` nullable** (`String? @unique`). Do not rewrite seed reviews.
- **Never accept `venueId` from the client** — derive it from the server-loaded booking.
- **No review-id-based mutation API.** Create/edit go through `/api/bookings/[id]/review`.
- **No delete, no photos, no owner replies** this phase. `ownerReply` stays an unused column.
- Do not modify the booking state machine, conflict model, or EXCLUDE constraint.
- UI must reuse existing tokens/components: `Button` (variants `primary|secondary|outline|ghost|danger`, sizes `sm|md|lg|icon`, `block`, `loading`), `useToast()` (`{ title, description?, tone?: "default"|"success"|"error" }`), `cn`, brand colors (`brand-*`, `ink`, `ink-soft`, `muted`), `rounded-2xl` cards.
- Error classes (`src/lib/booking/errors.ts`): `ValidationError` (400), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409). API maps them via `errorResponse`.
- Verification gate (must stay green): `npm run typecheck` = 0, `npm run lint` = 0, `npm test` green, `npm run build` green, plus the HTTP e2e chain in Task 15.
- Commit locally after each task. **Do not push** the branch.

---

## File Structure

**Create:**
- `prisma/migrations/20260907160000_reviews_phase5/migration.sql` — add `updatedAt`, rating CHECK, swap venue index.
- `src/lib/review/eligibility.ts` — `reviewEligibility`, `reviewerDisplayName`, eligibility types.
- `src/lib/review/service.ts` — `createReview`, `updateReview`, `recomputeVenueRating`, `venueRatingSummary`, `listVenueReviews`, `listReviewsForVenues`.
- `src/lib/review/index.ts` — re-exports.
- `src/app/api/bookings/[id]/review/route.ts` — `POST` (create) + `PATCH` (edit).
- `src/components/review/Stars.tsx` — read-only star display (server-safe).
- `src/components/review/StarRating.tsx` — interactive star picker (client).
- `src/components/review/ReviewPrompt.tsx` — client create/edit/display card.
- `src/app/(owner)/owner/reviews/page.tsx` — owner (and admin) read-only review view.
- Tests: `tests/review/eligibility.test.ts`, `create.test.ts`, `duplicate.test.ts`, `authz.test.ts`, `aggregate.test.ts`, `visibility.test.ts`, `notify.test.ts`.

**Modify:**
- `prisma/schema.prisma` — `Review` model (`updatedAt`, index).
- `src/lib/notifications/types.ts` — add `REVIEW_INVITE`.
- `src/lib/notifications/service.ts` — add `onCompleted`, export it.
- `src/lib/booking/local-backend.ts:302-305` — fire `onCompleted` on `COMPLETED`.
- `src/app/(site)/bookings/[reference]/page.tsx` — render `ReviewPrompt` for the owner's `COMPLETED` booking.
- `src/app/(site)/venues/[slug]/page.tsx:27-45,287-308` — use `venueRatingSummary` + `listVenueReviews`, add review date + distribution.
- `src/app/(owner)/layout.tsx:33-38` — add a "Reviews" nav link.
- `tests/factories.ts` — add `seedCustomer`, `seedCompletedBooking`, `seedConfirmedBooking`.

---

# Phase 5A — Schema + service + API + notification

### Task 1: Migration + schema for reviews

**Files:**
- Create: `prisma/migrations/20260907160000_reviews_phase5/migration.sql`
- Modify: `prisma/schema.prisma` (Review model)

**Interfaces:**
- Produces: `Review.updatedAt: DateTime`; DB CHECK `reviews_rating_range`; index `reviews_venueId_createdAt_idx`. Prisma client regenerated so `review.updatedAt` is typed.

- [ ] **Step 1: Write the migration SQL**

Create `prisma/migrations/20260907160000_reviews_phase5/migration.sql`:

```sql
-- Phase 5: reviews get updatedAt, a rating range check, and a composite index
-- for recent-reviews ordering. bookingId stays nullable+unique (seed reviews
-- are null; the unique index still enforces one review per real booking).
ALTER TABLE "reviews" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

DROP INDEX IF EXISTS "reviews_venueId_idx";
CREATE INDEX "reviews_venueId_createdAt_idx" ON "reviews" ("venueId", "createdAt");
```

- [ ] **Step 2: Update the Prisma model**

In `prisma/schema.prisma`, replace the `Review` model body's `createdAt` line and index:

```prisma
model Review {
  id         String   @id @default(cuid())
  venueId    String
  venue      Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  bookingId  String?  @unique
  rating     Int
  body       String?
  ownerReply String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([venueId, createdAt])
  @@map("reviews")
}
```

- [ ] **Step 3: Apply migration + regenerate client**

Run: `npm run db:deploy && npm run db:generate`
Expected: migration `20260907160000_reviews_phase5` applied; client regenerates with no errors.

- [ ] **Step 4: Verify schema is in sync and typecheck passes**

Run: `npm run typecheck`
Expected: 0 errors (the generated client now exposes `updatedAt`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260907160000_reviews_phase5
git commit -m "feat(reviews): add updatedAt, rating CHECK, and venue+createdAt index"
```

---

### Task 2: Eligibility service

**Files:**
- Create: `src/lib/review/eligibility.ts`
- Test: `tests/review/eligibility.test.ts`
- Modify: `tests/factories.ts` (add helpers)

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces:
  - `type EligibilityReason = "NOT_FOUND" | "NOT_OWNER" | "NOT_COMPLETED" | "ALREADY_REVIEWED"`
  - `interface EligibilityResult { eligible: boolean; reason?: EligibilityReason; venueId?: string; existingReview?: { id: string; rating: number; body: string | null } | null }`
  - `reviewEligibility(bookingId: string, userId: string): Promise<EligibilityResult>`
  - `reviewerDisplayName(user: { name: string | null; email: string }): string`
  - Factories: `seedCustomer()`, `seedCompletedBooking(opts?)`, `seedConfirmedBooking(opts?)`.

- [ ] **Step 1: Add test factories**

In `tests/factories.ts`, append:

```ts
export async function seedCustomer() {
  return prisma.user.create({
    data: { email: `c-${rid()}@t.test`, name: "Casey Customer", role: "CUSTOMER" },
  });
}

/** Owner+venue+court+customer + a booking row created directly at a given status. */
async function seedBookingAt(status: "CONFIRMED" | "COMPLETED", opts?: { priceCents?: number }) {
  const base = await seedOwnerVenueCourt(opts);
  const customer = await seedCustomer();
  const s = slot();
  const booking = await prisma.booking.create({
    data: {
      reference: `RP-${rid().toUpperCase()}`,
      venueId: base.venueId,
      courtId: base.courtId,
      userId: customer.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status,
      priceCents: opts?.priceCents ?? 40000,
    },
  });
  return { ...base, customerId: customer.id, bookingId: booking.id, reference: booking.reference };
}

export function seedCompletedBooking(opts?: { priceCents?: number }) {
  return seedBookingAt("COMPLETED", opts);
}

export function seedConfirmedBooking(opts?: { priceCents?: number }) {
  return seedBookingAt("CONFIRMED", opts);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/review/eligibility.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedConfirmedBooking, seedCustomer } from "../factories";
import { reviewEligibility } from "@/lib/review/eligibility";

beforeEach(resetDb);

describe("reviewEligibility", () => {
  it("a completed booking owned by the user is eligible", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: true, venueId, existingReview: null });
  });

  it("a non-completed booking is not eligible", async () => {
    const { customerId, bookingId } = await seedConfirmedBooking();
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_COMPLETED" });
  });

  it("a booking owned by someone else is not eligible", async () => {
    const { bookingId } = await seedCompletedBooking();
    const other = await seedCustomer();
    const r = await reviewEligibility(bookingId, other.id);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_OWNER" });
  });

  it("an already-reviewed booking is not eligible", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 5 } });
    const r = await reviewEligibility(bookingId, customerId);
    expect(r).toMatchObject({ eligible: false, reason: "ALREADY_REVIEWED" });
    expect(r.existingReview?.rating).toBe(5);
  });

  it("a missing booking is not eligible", async () => {
    const other = await seedCustomer();
    const r = await reviewEligibility("nope", other.id);
    expect(r).toMatchObject({ eligible: false, reason: "NOT_FOUND" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/review/eligibility.test.ts`
Expected: FAIL — cannot import `reviewEligibility` (module not found).

- [ ] **Step 4: Implement eligibility**

Create `src/lib/review/eligibility.ts`:

```ts
import prisma from "@/lib/prisma";

export type EligibilityReason = "NOT_FOUND" | "NOT_OWNER" | "NOT_COMPLETED" | "ALREADY_REVIEWED";

export interface EligibilityResult {
  eligible: boolean;
  reason?: EligibilityReason;
  venueId?: string;
  existingReview?: { id: string; rating: number; body: string | null } | null;
}

/** Server-authoritative check: booking exists, is owned by the user, is COMPLETED, not yet reviewed. */
export async function reviewEligibility(bookingId: string, userId: string): Promise<EligibilityResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, venueId: true, status: true },
  });
  if (!booking) return { eligible: false, reason: "NOT_FOUND" };
  if (booking.userId !== userId) return { eligible: false, reason: "NOT_OWNER" };

  const existingReview = await prisma.review.findUnique({
    where: { bookingId },
    select: { id: true, rating: true, body: true },
  });

  if (booking.status !== "COMPLETED") {
    return { eligible: false, reason: "NOT_COMPLETED", venueId: booking.venueId, existingReview };
  }
  if (existingReview) {
    return { eligible: false, reason: "ALREADY_REVIEWED", venueId: booking.venueId, existingReview };
  }
  return { eligible: true, venueId: booking.venueId, existingReview: null };
}

/** Public-safe author label. Never leak email/mobile — only a name or the email local-part. */
export function reviewerDisplayName(user: { name: string | null; email: string }): string {
  return user.name ?? user.email.split("@")[0];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/review/eligibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/review/eligibility.ts tests/review/eligibility.test.ts tests/factories.ts
git commit -m "feat(reviews): server-side review eligibility check + test factories"
```

---

### Task 3: Create/edit service + aggregate recompute

**Files:**
- Create: `src/lib/review/service.ts`, `src/lib/review/index.ts`
- Test: `tests/review/create.test.ts`, `tests/review/duplicate.test.ts`, `tests/review/aggregate.test.ts`

**Interfaces:**
- Consumes: `reviewEligibility`, `reviewerDisplayName` from `./eligibility`; error classes from `@/lib/booking/errors`; `Prisma` from `@/generated/prisma`.
- Produces:
  - `createReview(input: { bookingId: string; userId: string; rating: number; body?: string | null }): Promise<{ id: string; rating: number; body: string | null; createdAt: Date; updatedAt: Date }>`
  - `updateReview(input: { bookingId: string; userId: string; rating: number; body?: string | null }): Promise<{ id: string; rating: number; body: string | null; createdAt: Date; updatedAt: Date }>`
  - `venueRatingSummary(venueId: string): Promise<{ avg: number; count: number; distribution: Record<1|2|3|4|5, number> }>`
  - `listVenueReviews(venueId: string, take?: number): Promise<Array<{ id: string; rating: number; body: string | null; createdAt: Date; authorName: string }>>`
  - `listReviewsForVenues(venueIds: string[], take?: number): Promise<Array<{ id: string; rating: number; body: string | null; createdAt: Date; venueId: string; venueName: string; authorName: string }>>`
  - `recomputeVenueRating(tx, venueId): Promise<void>` (internal; exported for tests is not required).

- [ ] **Step 1: Write the failing tests**

Create `tests/review/create.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedConfirmedBooking } from "../factories";
import { createReview } from "@/lib/review/service";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("createReview", () => {
  it("accepts a valid rating and stores venueId derived from the booking", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    const r = await createReview({ bookingId, userId: customerId, rating: 5, body: "Great courts" });
    expect(r.rating).toBe(5);
    const row = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.venueId).toBe(venueId);
    expect(row.bookingId).toBe(bookingId);
  });

  it("stores an empty/whitespace comment as null", async () => {
    const { customerId, bookingId } = await seedCompletedBooking();
    const r = await createReview({ bookingId, userId: customerId, rating: 4, body: "   " });
    expect(r.body).toBeNull();
  });

  it.each([0, 6, 2.5, -1])("rejects invalid rating %s", async (bad) => {
    const { customerId, bookingId } = await seedCompletedBooking();
    await expect(
      createReview({ bookingId, userId: customerId, rating: bad as number }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a review on a non-completed booking", async () => {
    const { customerId, bookingId } = await seedConfirmedBooking();
    await expect(
      createReview({ bookingId, userId: customerId, rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a review by a non-owner", async () => {
    const { bookingId } = await seedCompletedBooking();
    await expect(
      createReview({ bookingId, userId: "someone-else", rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

Create `tests/review/duplicate.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking } from "../factories";
import { createReview } from "@/lib/review/service";
import { ConflictError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("duplicate protection", () => {
  it("rejects a second review for the same booking (service)", async () => {
    const { customerId, bookingId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5 });
    await expect(
      createReview({ bookingId, userId: customerId, rating: 3 }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.review.count({ where: { bookingId } })).toBe(1);
  });

  it("enforces one review per booking at the database (unique index)", async () => {
    const { customerId, bookingId, venueId } = await seedCompletedBooking();
    await prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 5 } });
    await expect(
      prisma.review.create({ data: { bookingId, venueId, userId: customerId, rating: 1 } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
```

Create `tests/review/aggregate.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCompletedBooking, seedConfirmedBooking, seedCustomer } from "../factories";
import { createReview, venueRatingSummary } from "@/lib/review/service";

beforeEach(resetDb);

// Add a second completed booking on the SAME venue for a second reviewer.
async function secondCompletedBookingFor(venueId: string, courtId: string) {
  const customer = await seedCustomer();
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + 5);
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  const b = await prisma.booking.create({
    data: { reference: `RP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, venueId, courtId, userId: customer.id, startsAt, endsAt, status: "COMPLETED", priceCents: 40000 },
  });
  return { customerId: customer.id, bookingId: b.id };
}

describe("rating aggregates", () => {
  it("updates venue ratingAvg and ratingCount on create", async () => {
    const { customerId, bookingId, venueId, courtId } = await seedCompletedBooking();
    await createReview({ bookingId, userId: customerId, rating: 5 });
    const second = await secondCompletedBookingFor(venueId, courtId);
    await createReview({ bookingId: second.bookingId, userId: second.customerId, rating: 4 });

    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue.ratingCount).toBe(2);
    expect(venue.ratingAvg).toBe(4.5);

    const summary = await venueRatingSummary(venueId);
    expect(summary).toMatchObject({ count: 2, avg: 4.5 });
    expect(summary.distribution[5]).toBe(1);
    expect(summary.distribution[4]).toBe(1);
  });
});
```

Note: `seedCompletedBooking` returns `courtId` (from `seedOwnerVenueCourt`), so `venueId`/`courtId` are available above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/review/create.test.ts tests/review/duplicate.test.ts tests/review/aggregate.test.ts`
Expected: FAIL — `createReview`/`venueRatingSummary` not found.

- [ ] **Step 3: Implement the service**

Create `src/lib/review/service.ts`:

```ts
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from "@/lib/booking/errors";
import { reviewerDisplayName } from "./eligibility";

const MAX_BODY = 1000;

type Tx = Prisma.TransactionClient;

function validate(rating: unknown, body: unknown): { rating: number; body: string | null } {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError("Rating must be a whole number from 1 to 5");
  }
  let clean: string | null = null;
  if (typeof body === "string") {
    const t = body.trim();
    if (t.length > MAX_BODY) throw new ValidationError(`Keep your review under ${MAX_BODY} characters`);
    clean = t.length ? t : null;
  } else if (body != null) {
    throw new ValidationError("Invalid review text");
  }
  return { rating, body: clean };
}

/** Recompute the denormalized venue aggregate inside the write transaction. */
async function recomputeVenueRating(tx: Tx, venueId: string): Promise<void> {
  const agg = await tx.review.aggregate({ where: { venueId }, _avg: { rating: true }, _count: true });
  const avg = agg._avg.rating ?? 0;
  await tx.venue.update({
    where: { id: venueId },
    data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: agg._count },
  });
}

const REVIEW_SELECT = { id: true, rating: true, body: true, createdAt: true, updatedAt: true } as const;

export interface CreateReviewInput { bookingId: string; userId: string; rating: number; body?: string | null }

export async function createReview(input: CreateReviewInput) {
  const { rating, body } = validate(input.rating, input.body);
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, userId: true, venueId: true, status: true },
      });
      if (!booking) throw new NotFoundError("Booking not found");
      if (booking.userId !== input.userId) throw new ForbiddenError();
      if (booking.status !== "COMPLETED") throw new ConflictError("You can review only after your booking is completed");

      const existing = await tx.review.findUnique({ where: { bookingId: input.bookingId }, select: { id: true } });
      if (existing) throw new ConflictError("You already reviewed this booking");

      const review = await tx.review.create({
        data: { bookingId: booking.id, venueId: booking.venueId, userId: input.userId, rating, body },
        select: REVIEW_SELECT,
      });
      await recomputeVenueRating(tx, booking.venueId);
      return review;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError("You already reviewed this booking");
    }
    throw e;
  }
}

export interface UpdateReviewInput { bookingId: string; userId: string; rating: number; body?: string | null }

export async function updateReview(input: UpdateReviewInput) {
  const { rating, body } = validate(input.rating, input.body);
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, userId: true, venueId: true },
    });
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.userId !== input.userId) throw new ForbiddenError();

    const review = await tx.review.findUnique({ where: { bookingId: input.bookingId }, select: { id: true, userId: true } });
    if (!review) throw new NotFoundError("Review not found");
    if (review.userId !== input.userId) throw new ForbiddenError();

    const updated = await tx.review.update({ where: { id: review.id }, data: { rating, body }, select: REVIEW_SELECT });
    await recomputeVenueRating(tx, booking.venueId);
    return updated;
  });
}

export interface RatingSummary { avg: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> }

export async function venueRatingSummary(venueId: string): Promise<RatingSummary> {
  const groups = await prisma.review.groupBy({ by: ["rating"], where: { venueId }, _count: true });
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const g of groups) {
    const r = g.rating as 1 | 2 | 3 | 4 | 5;
    distribution[r] = g._count;
    total += g._count;
    sum += g.rating * g._count;
  }
  return { avg: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution };
}

export async function listVenueReviews(venueId: string, take = 6) {
  const rows = await prisma.review.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, body: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, authorName: reviewerDisplayName(r.user) }));
}

export async function listReviewsForVenues(venueIds: string[], take = 50) {
  if (venueIds.length === 0) return [];
  const rows = await prisma.review.findMany({
    where: { venueId: { in: venueIds } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, rating: true, body: true, createdAt: true, venueId: true,
      venue: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, venueId: r.venueId, venueName: r.venue.name, authorName: reviewerDisplayName(r.user) }));
}
```

Create `src/lib/review/index.ts`:

```ts
export * from "./eligibility";
export * from "./service";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/review/create.test.ts tests/review/duplicate.test.ts tests/review/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` → 0 errors.

```bash
git add src/lib/review tests/review/create.test.ts tests/review/duplicate.test.ts tests/review/aggregate.test.ts
git commit -m "feat(reviews): create/edit service with transactional aggregate recompute"
```

---

### Task 4: Authorization tests (edit ownership + owner scoping)

**Files:**
- Test: `tests/review/authz.test.ts`

**Interfaces:**
- Consumes: `updateReview`, `listReviewsForVenues` from `@/lib/review`; `accessibleVenueIds` from `@/lib/api/owner-access`.

- [ ] **Step 1: Write the failing test**

Create `tests/review/authz.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails, then passes**

Run: `npm test -- tests/review/authz.test.ts`
Expected: PASS immediately (implementation from Task 3 already satisfies these). If a `ForbiddenError` assertion fails, fix `updateReview`'s ownership check before proceeding.

- [ ] **Step 3: Commit**

```bash
git add tests/review/authz.test.ts
git commit -m "test(reviews): edit-ownership and owner-scoping authorization"
```

---

### Task 5: Review API route (POST create + PATCH edit)

**Files:**
- Create: `src/app/api/bookings/[id]/review/route.ts`

**Interfaces:**
- Consumes: `requireOwnBooking` from `@/lib/api/booking-access` (returns `{ session, booking }`); `createReview`/`updateReview` from `@/lib/review`; `errorResponse` from `@/lib/http`.
- Produces: `POST`/`PATCH` handlers returning `{ review }`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/bookings/[id]/review/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { createReview, updateReview } from "@/lib/review";
import { errorResponse } from "@/lib/http";

// Create a review for a booking the caller owns. venueId is derived server-side
// from the booking; the client never supplies it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireOwnBooking(id);
    const { rating, body } = (await req.json().catch(() => ({}))) as { rating?: unknown; body?: unknown };
    const review = await createReview({ bookingId: id, userId: session.id, rating: rating as number, body: body as string | null });
    return NextResponse.json({ review });
  } catch (e) {
    return errorResponse(e);
  }
}

// Edit the caller's own review for a booking they own. No review-id API exists.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireOwnBooking(id);
    const { rating, body } = (await req.json().catch(() => ({}))) as { rating?: unknown; body?: unknown };
    const review = await updateReview({ bookingId: id, userId: session.id, rating: rating as number, body: body as string | null });
    return NextResponse.json({ review });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors. (`requireOwnBooking` already 401s for anon, 403s for non-owner; `createReview`/`updateReview` enforce eligibility. HTTP-level behavior is covered by the e2e in Task 15.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bookings/[id]/review/route.ts
git commit -m "feat(reviews): booking-scoped POST/PATCH review API"
```

---

### Task 6: REVIEW_INVITE notification on completion

**Files:**
- Modify: `src/lib/notifications/types.ts`, `src/lib/notifications/service.ts`, `src/lib/booking/local-backend.ts:302-305`
- Test: `tests/review/notify.test.ts`

**Interfaces:**
- Consumes: existing `createOnce`, `loadBooking`, `playerLink`, `dateLabel`.
- Produces: `NotificationType.REVIEW_INVITE`; `notificationService.onCompleted(bookingId: string): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `tests/review/notify.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking } from "../factories";
import { bookingBackend } from "@/lib/booking";

beforeEach(resetDb);

describe("REVIEW_INVITE notification", () => {
  it("is created (once) for the customer when a booking is completed", async () => {
    const { ownerId, bookingId, customerId } = await seedConfirmedBooking();
    await bookingBackend.complete(bookingId, { type: "OWNER", id: ownerId });
    const count = await prisma.notification.count({
      where: { userId: customerId, type: "REVIEW_INVITE", bookingId },
    });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/review/notify.test.ts`
Expected: FAIL — count is 0 (no notification fired on completion yet).

- [ ] **Step 3: Add the notification type**

In `src/lib/notifications/types.ts`, add inside the `NotificationType` object (after `BOOKING_REMINDER`):

```ts
  REVIEW_INVITE: "REVIEW_INVITE",
```

- [ ] **Step 4: Add the `onCompleted` helper**

In `src/lib/notifications/service.ts`, add after `onExpired` (before `sweepUpcomingReminders`):

```ts
async function onCompleted(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || !b.userId) return;
  await createOnce({
    userId: b.userId,
    type: NotificationType.REVIEW_INVITE,
    title: "How was your experience?",
    body: `Rate your visit to ${b.venue.name} on ${dateLabel(b.startsAt)}.`,
    link: playerLink(b.reference),
    bookingId,
  });
}
```

Then add `onCompleted` to the exported `notificationService` object (after `onExpired,`):

```ts
  onCompleted,
```

- [ ] **Step 5: Fire it from the booking backend**

In `src/lib/booking/local-backend.ts`, in the `transition` method's post-commit block (currently lines ~302-304), add a branch:

```ts
    if (to === "CONFIRMED") await safeNotify(() => notificationService.onConfirmed(bookingId));
    else if (to === "REJECTED") await safeNotify(() => notificationService.onRejected(bookingId));
    else if (to === "CANCELLED") await safeNotify(() => notificationService.onCancelled(bookingId, actor.type));
    else if (to === "COMPLETED") await safeNotify(() => notificationService.onCompleted(bookingId));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/review/notify.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck` → 0 errors.

```bash
git add src/lib/notifications/types.ts src/lib/notifications/service.ts src/lib/booking/local-backend.ts tests/review/notify.test.ts
git commit -m "feat(reviews): REVIEW_INVITE notification fired after completion"
```

---

# Phase 5B — Customer UI

### Task 7: Star components

**Files:**
- Create: `src/components/review/Stars.tsx`, `src/components/review/StarRating.tsx`

**Interfaces:**
- Produces:
  - `Stars(props: { value: number; className?: string })` — read-only, server-safe.
  - `StarRating(props: { value: number; onChange: (v: number) => void; size?: "sm" | "lg" })` — client, interactive.

- [ ] **Step 1: Implement `Stars` (read-only)**

Create `src/components/review/Stars.tsx`:

```tsx
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/** Read-only star row. Rounds to the nearest whole star for display. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <div className={cn("flex gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-4", n <= filled ? "fill-amber-400 text-amber-400" : "text-slate-300")}
          aria-hidden
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `StarRating` (interactive)**

Create `src/components/review/StarRating.tsx`:

```tsx
"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function StarRating({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "lg";
}) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  const px = size === "lg" ? "size-9" : "size-6";
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Star className={cn(px, n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint` → 0 errors.

```bash
git add src/components/review/Stars.tsx src/components/review/StarRating.tsx
git commit -m "feat(reviews): read-only Stars + interactive StarRating components"
```

---

### Task 8: ReviewPrompt (create / edit / display)

**Files:**
- Create: `src/components/review/ReviewPrompt.tsx`

**Interfaces:**
- Consumes: `StarRating`, `Stars`, `Button`, `useToast`, `useRouter`.
- Produces: `ReviewPrompt(props: { bookingId: string; venueName: string; existing: { rating: number; body: string | null } | null })`.

- [ ] **Step 1: Implement the component**

Create `src/components/review/ReviewPrompt.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StarRating } from "./StarRating";
import { Stars } from "./Stars";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReviewPrompt({
  bookingId,
  venueName,
  existing,
}: {
  bookingId: string;
  venueName: string;
  existing: { rating: number; body: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(existing === null);
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  const [body, setBody] = React.useState(existing?.body ?? "");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (rating < 1) {
      toast({ title: "Pick a rating first", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body.trim() || null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Something went wrong");
      }
      toast({ title: existing ? "Review updated" : "Thanks for your review!", tone: "success" });
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to submit", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (existing && !editing) {
    return (
      <section className="mt-4 rounded-2xl border border-black/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Your review</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="mt-2">
          <Stars value={existing.rating} />
        </div>
        {existing.body && <p className="mt-1.5 text-sm text-ink-soft">{existing.body}</p>}
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-black/5 p-4">
      <h2 className="text-base font-bold text-ink">How was your experience?</h2>
      <p className="mt-0.5 text-sm text-muted">Rate your visit to {venueName}.</p>
      <div className="mt-3">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Share a little about your visit (optional)"
        className="mt-3 w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      />
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} loading={busy} size="lg">
          {existing ? "Save changes" : "Submit review"}
        </Button>
        {existing && (
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint` → 0 errors.

```bash
git add src/components/review/ReviewPrompt.tsx
git commit -m "feat(reviews): ReviewPrompt create/edit/display card"
```

---

### Task 9: Wire ReviewPrompt into the completed-booking page

**Files:**
- Modify: `src/app/(site)/bookings/[reference]/page.tsx`

**Interfaces:**
- Consumes: `reviewEligibility` from `@/lib/review`; `ReviewPrompt`.

- [ ] **Step 1: Add imports**

At the top of `src/app/(site)/bookings/[reference]/page.tsx`, add:

```tsx
import { reviewEligibility } from "@/lib/review";
import { ReviewPrompt } from "@/components/review/ReviewPrompt";
```

- [ ] **Step 2: Compute the review block after loading the booking**

After the `const canResume = ...` block (around line 53), add:

```tsx
  const showReview = b.status === "COMPLETED" && b.userId === session.id;
  const eligibility = showReview ? await reviewEligibility(b.id, session.id) : null;
```

- [ ] **Step 3: Render the prompt**

Immediately after the closing `)}` of the `canResume` block (around line 81, before the `{/* Progress */}` section), add:

```tsx
      {showReview && (
        <ReviewPrompt
          bookingId={b.id}
          venueName={b.venue.name}
          existing={eligibility?.existingReview ?? null}
        />
      )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint` → 0 errors.

- [ ] **Step 5: Manual verify**

Start dev (`npm run dev`), sign in as `player@rallypoint.test`, open a booking. (Full click-through is covered by the e2e in Task 15; here just confirm the page compiles and the prompt renders on a COMPLETED booking — you can temporarily set a booking to COMPLETED via `npm run db:studio` if needed.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(site)/bookings/[reference]/page.tsx"
git commit -m "feat(reviews): show review prompt on completed booking page"
```

---

# Phase 5C — Venue page + aggregates

### Task 10: Venue page uses summary + recent reviews with date + distribution

**Files:**
- Modify: `src/app/(site)/venues/[slug]/page.tsx`

**Interfaces:**
- Consumes: `venueRatingSummary`, `listVenueReviews` from `@/lib/review`; `Stars`; `dateLabel` (already imported).

- [ ] **Step 1: Replace the inline `reviews` include in `loadVenue`**

In `loadVenue` (lines 30-45), remove the `reviews: { ... }` include block (the venue no longer needs to embed reviews; we load them separately). The `include` should keep only `courts`.

- [ ] **Step 2: Add imports**

Add to the import block:

```tsx
import { venueRatingSummary, listVenueReviews } from "@/lib/review";
import { Stars } from "@/components/review/Stars";
```

- [ ] **Step 3: Load summary + reviews in the page body**

After `const venue = await loadVenue(slug);` and the not-found/preview gating (after line 89), add:

```tsx
  const [ratingSummary, recentReviews] = await Promise.all([
    venueRatingSummary(venue.id),
    listVenueReviews(venue.id, 6),
  ]);
```

- [ ] **Step 4: Use the summary in the header**

Replace the header rating span (lines 158-162) with:

```tsx
        <span className="flex items-center gap-1 text-ink-soft">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-semibold text-ink">{ratingSummary.avg.toFixed(1)}</span>
          <span>({ratingSummary.count} reviews)</span>
        </span>
```

- [ ] **Step 5: Rebuild the Reviews section with distribution + dated reviews**

Replace the entire `{/* Reviews */}` section (lines 287-308) with:

```tsx
      {/* Reviews */}
      <section className="mt-8 mb-8">
        <h2 className="text-lg font-bold text-ink">Reviews</h2>
        {ratingSummary.count === 0 ? (
          <p className="mt-2 text-muted">No reviews yet.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink">{ratingSummary.avg.toFixed(1)}</span>
                <Stars value={ratingSummary.avg} />
                <span className="text-sm text-muted">{ratingSummary.count} reviews</span>
              </div>
              <ul className="min-w-[12rem] flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = ratingSummary.distribution[n as 1 | 2 | 3 | 4 | 5];
                  const pct = ratingSummary.count ? Math.round((c / ratingSummary.count) * 100) : 0;
                  return (
                    <li key={n} className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-3 text-right">{n}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-6 text-right">{c}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <ul className="mt-5 space-y-4">
              {recentReviews.map((r) => (
                <li key={r.id} className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Stars value={r.rating} />
                      <span className="font-medium text-ink">{r.authorName}</span>
                    </div>
                    <span className="text-xs text-muted">{dateLabel(r.createdAt)}</span>
                  </div>
                  {r.body && <p className="mt-1.5 text-ink-soft">{r.body}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint` → 0 errors. (Confirm `venue.reviews` is no longer referenced anywhere in the file — the `venueJsonLd(venue)` call does not need reviews.)

- [ ] **Step 7: Manual verify + commit**

Open a seeded venue page in dev; confirm aggregate, distribution bars, and dated reviews render.

```bash
git add "src/app/(site)/venues/[slug]/page.tsx"
git commit -m "feat(reviews): venue page uses server aggregate + dated recent reviews"
```

---

# Phase 5D — Owner review view

### Task 11: Owner reviews page + nav link

**Files:**
- Create: `src/app/(owner)/owner/reviews/page.tsx`
- Modify: `src/app/(owner)/layout.tsx:33-38`

**Interfaces:**
- Consumes: `getSession`, `accessibleVenueIds`, `listReviewsForVenues`, `Stars`, `dateLabel`, `EmptyState`.

- [ ] **Step 1: Create the owner reviews page**

Create `src/app/(owner)/owner/reviews/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { listReviewsForVenues } from "@/lib/review";
import { Stars } from "@/components/review/Stars";
import { EmptyState } from "@/components/ui/states";
import { dateLabel } from "@/lib/format";

export const metadata = { title: "Reviews" };

export default async function OwnerReviewsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/owner/reviews");

  const ids = await accessibleVenueIds(session.id, session.role);
  const reviews = await listReviewsForVenues(ids, 100);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Reviews</h1>
      <p className="mt-1 text-sm text-muted">What players say about your venues.</p>

      {reviews.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Star className="size-7" />}
            title="No reviews yet"
            description="Reviews appear here after players complete a booking and rate their visit."
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="font-medium text-ink">{r.authorName}</span>
                </div>
                <span className="text-xs text-muted">{dateLabel(r.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-brand-700">{r.venueName}</p>
              {r.body && <p className="mt-1.5 text-sm text-ink-soft">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `src/app/(owner)/layout.tsx`, after the "Reservations" `Link` (line 35), add:

```tsx
            <Link href="/owner/reviews" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-black/5">
              Reviews
            </Link>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint` → 0 errors.

- [ ] **Step 4: Manual verify (owner + admin)**

In dev, sign in as `owner@rallypoint.test` → `/owner/reviews` shows seeded reviews for owned venues only. Sign in as `admin@rallypoint.test` → the same page shows reviews across all venues (admin sees all via `accessibleVenueIds`). This satisfies admin inspection with no separate UI.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(owner)/owner/reviews/page.tsx" "src/app/(owner)/layout.tsx"
git commit -m "feat(reviews): owner review view (admin sees all) + nav link"
```

---

# Phase 5E — Marketplace integration

### Task 12: Verify + test marketplace card rating flow

**Files:**
- Test: `tests/review/visibility.test.ts`
- (Verify only, likely no change: `src/components/venue/VenueCard.tsx`, `src/lib/venues.ts`, `src/app/(site)/search/page.tsx`.)

**Interfaces:**
- Consumes: `featuredVenues` from `@/lib/venues`; `createReview` from `@/lib/review`.

- [ ] **Step 1: Write the visibility + card-data test**

Create `tests/review/visibility.test.ts`:

```ts
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
    const card = cards.find((c) => c.slug && c.ratingCount > 0);
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
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/review/visibility.test.ts`
Expected: PASS. `featuredVenues` already filters `isPublished + APPROVED` and maps `ratingAvg/ratingCount`; `VenueCard` and the search page already render them. If the first test fails on card mapping, confirm `featuredVenues` maps `ratingAvg`/`ratingCount` (it does, per `src/lib/venues.ts:26-27`) — no code change expected.

- [ ] **Step 3: Manual verify + commit**

Confirm home/search cards show real rating for a venue you just reviewed in dev.

```bash
git add tests/review/visibility.test.ts
git commit -m "test(reviews): marketplace card rating flow + unpublished not exposed"
```

---

# Phase 5F — Tests + polish + full gate

### Task 13: Full suite + regression

**Files:** none (verification).

- [ ] **Step 1: Run the entire suite**

Run: `npm test`
Expected: all Phase 1–4 tests still green **plus** the new `tests/review/*` (eligibility, create, duplicate, aggregate, authz, notify, visibility). Total should be prior count (98) + new tests.

- [ ] **Step 2: If any Phase 1–4 test regressed**

Do not weaken it. Investigate with superpowers:systematic-debugging. Likely causes: the `updatedAt` column (regenerate client with `npm run db:generate`) or the dropped `reviews_venueId_idx`. Fix the cause, re-run.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "test(reviews): full-suite regression pass"
```

---

### Task 14: Responsive polish + static gate

**Files:** touch-ups only in `src/components/review/*` and the two pages, as needed.

- [ ] **Step 1: Mobile check**

In dev at 390px width: the star picker targets are ≥44px tall (size-9 buttons + padding), the review card and distribution bars wrap cleanly, and the owner list is single-column. Adjust spacing classes only if something overflows.

- [ ] **Step 2: Full static gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: typecheck 0, lint 0, production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "polish(reviews): mobile-first spacing + static gate green"
```

---

### Task 15: HTTP end-to-end verification

**Files:** none (manual e2e against the running dev server; mirrors the Phase 4 e2e style).

Run `npm run dev` in one terminal. Use the dev magic-link banner to sign in as each user. Prepare a `COMPLETED` booking for `player@rallypoint.test` at an owned venue (create through the normal flow, then have the owner confirm and mark complete via owner ops, or set status via `npm run db:studio`).

- [ ] **Step 1: Eligible customer submits 5★**

As the player, POST to `/api/bookings/<id>/review` with `{ "rating": 5, "body": "Fantastic courts" }` (or via the on-page prompt). Expected: `200 { review: { rating: 5, ... } }`.

- [ ] **Step 2: Venue rating updates**

Reload the venue page. Expected: `ratingAvg`/`ratingCount` reflect the new review; the review appears in the Reviews section with today's date.

- [ ] **Step 3: Review appears on the venue card**

Open home (`/`) or search. Expected: the venue card shows the updated rating/count.

- [ ] **Step 4: Owner can see it**

Sign in as `owner@rallypoint.test` → `/owner/reviews`. Expected: the review is listed with venue name, stars, author display name, date.

- [ ] **Step 5: Unauthorized user cannot manipulate it**

As a different signed-in customer, POST/PATCH `/api/bookings/<id>/review` for that booking id. Expected: `403 forbidden` (not the owner of the booking). As an anonymous request: `401 unauthorized`.

- [ ] **Step 6: Duplicate review rejected**

As the original player, POST again to `/api/bookings/<id>/review`. Expected: `409 conflict` ("You already reviewed this booking").

- [ ] **Step 7: Record the e2e result**

Confirm every step above passed. This closes the verification gate. Do not push the branch.

---

## Self-Review (completed during planning)

**Spec coverage:**
- Eligibility (owned + COMPLETED + not-reviewed, server-side) → Task 2, Task 3 (re-checked in tx).
- Review creation (rating 1–5, comment, no photos) → Task 3; validation → Task 3 tests.
- Customer UI ("How was your experience?", rate/write/submit, edit) → Tasks 7–9.
- Venue page (avg, count, recent reviews, date, distribution) → Task 10.
- Venue discovery cards → Task 12 (already wired; verified + tested).
- Owner view (read-only, own venues) → Task 11.
- Moderation safety (admin inspect via existing authz) → Task 11 (admin sees all via `accessibleVenueIds`).
- Aggregation (server-side avg/count/distribution, recompute in tx) → Task 3.
- Data model (updatedAt, unique(bookingId), CHECK, index) → Task 1.
- Authorization (customer own only, owner scoped, no cross-user via id) → Tasks 3–5.
- Notifications (REVIEW_INVITE via existing seam, post-commit, deduped) → Task 6.
- Testing (all listed categories) → Tasks 2–6, 12, 13.
- Regression (Phase 1–4 green, state machine untouched) → Task 13; no edits to `status.ts`/EXCLUDE.
- Verification gate + e2e → Tasks 14–15.

**Placeholder scan:** none — every code step contains full code.

**Type consistency:** `createReview`/`updateReview` share `REVIEW_SELECT` (`id, rating, body, createdAt, updatedAt`); `EligibilityResult.existingReview` (`{id, rating, body}`) is assignable to `ReviewPrompt`'s `existing` (`{rating, body}`); `venueRatingSummary` returns `distribution` keyed `1|2|3|4|5` and the venue page indexes it with `as 1|2|3|4|5`; factories return `{ ownerId, venueId, courtId, customerId, bookingId, reference }` consumed consistently across tests.
