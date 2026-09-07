# RallyPoint Thin-Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one working end-to-end vertical of RallyPoint — player searches Davao, books a court (server-authoritative hold + countdown), uploads payment proof, owner confirms — on real Postgres with database-level double-booking protection and automated race/authz tests.

**Architecture:** Next.js 16 App Router (RSC + route handlers + server actions) → a thin service layer (`BookingEngine`/`LocalBookingBackend`, `AvailabilityEngine`, `Auth`) → Prisma → PostgreSQL 16. Occupancy correctness is guaranteed by a Postgres `EXCLUDE` constraint (`btree_gist`) on `(courtId, tstzrange)` over occupying statuses; the app layer adds idempotency keys and explicit `23P01`/retry handling. Three seams (`BookingBackend`, `PaymentProofStorage`, `EmailSender`) isolate the future Sentry connector, object storage, and real email.

**Tech Stack:** Next.js 16.2.x, TypeScript (strict), Prisma 6.x + `@prisma/client` (postgresql), PostgreSQL 16 (docker-compose), Tailwind CSS 4 (`@tailwindcss/postcss`), Radix UI primitives, lucide-react, `jose` (JWT sessions), `bcryptjs` (n/a for magic-link but kept for parity), Vitest (unit + Postgres-backed integration), optional Playwright (one happy-path e2e).

## Global Constraints

- Next.js is **16.2.x** — treat as diverging from training data; when unsure, mirror the proven patterns in `D:/PRJ-2/ledgerdex` and `D:/PRJ-2/files` (Prisma singleton, jose auth, `await cookies()`, `await params`, route handler signatures, Tailwind 4 globals). Consult `node_modules/next/dist/docs/` before using an unfamiliar API.
- **Web only.** No React Native / native. Mobile-first responsive web.
- Prisma client output: `src/generated/prisma`; import via `@/generated/prisma`. Singleton in `src/lib/prisma.ts`.
- Path alias `@/*` → `./src/*`. TS `strict: true`, `noEmit`, `moduleResolution: bundler`.
- **Secrets never reach the browser.** No Sentry key, no JWT secret, no venue payment account internals beyond what the venue chooses to display.
- **Server is authoritative** for price, availability, booking status, ownership, payment confirmation. Never trust the client for these.
- Money stored as integer minor units: `priceCents` / `amountCents` (centavos); display `₱{cents/100}`.
- Occupying statuses (protected by the DB constraint): `HELD, PENDING_PAYMENT, PAYMENT_SUBMITTED, PENDING_CONFIRMATION, CONFIRMED`. Freeing statuses: `EXPIRED, CANCELLED, REJECTED, COMPLETED`.
- Booking transactions use **READ COMMITTED** (default) with explicit handling of `23P01` (exclusion_violation → 409) and retry on `40001`/`40P01`. No blanket `SERIALIZABLE`.
- Palette: emerald/deep-green primary, lime accent, charcoal text, rounded cards, restrained shadows. Mobile-first.
- Do not build deferred features (onboarding wizard, admin verification UI, favorites-write, reviews-write, notifications delivery, owner calendar, walk-in UI, blocking UI, staff UI, interactive map, Sentry connector). Data model may include their tables; **no UI**.
- Verification gate: `npm run typecheck` + `npm run lint` + Vitest suite + `npm run build` all green; end-to-end journey works. Do not proceed past the gate with failures.

**Granularity note:** this plan gives full code for the correctness-critical core (schema, migration SQL, engines, interfaces, auth, the five required tests) where interfaces must lock and bugs are expensive. UI tasks give exact file lists, component contracts (props/behavior), and representative code rather than pixel-complete JSX for every element — the design system + palette tokens make the remaining markup mechanical.

---

## Phase 1 — Foundation

### Task 1: Scaffold project, tooling, Postgres, base config

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (temp), `.env.example`, `.env`, `docker-compose.yml`, `vitest.config.ts`, `README.md`

- [ ] **Step 1: Scaffold Next 16 + TS + Tailwind 4.** Run `npx create-next-app@latest . --typescript --eslint --app --tailwind --src-dir --import-alias "@/*" --use-npm --no-turbopack` in `d:\PRJ-3\pickle` (dir already has `.git`, `docs/`, `.gitignore` — accept overwrite prompts only for scaffold files; keep `docs/` and `.gitignore`). Verify installed `next` is 16.2.x.
- [ ] **Step 2: Add deps.** `npm i @prisma/client jose lucide-react clsx tailwind-merge class-variance-authority date-fns @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label @radix-ui/react-toast` and `npm i -D prisma vitest @vitejs/plugin-react tsx dotenv @types/node`. Pin Prisma: if `prisma@latest` resolves to 7.x and requires a driver adapter, install `prisma@^6 @prisma/client@^6` instead (plain postgresql, stable raw SQL). Record the chosen version in README.
- [ ] **Step 3: `next.config.ts`.** Mirror ledgerdex:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};
export default nextConfig;
```
- [ ] **Step 4: `docker-compose.yml`** (Postgres 16, two DBs: app + test via init script):
```yaml
services:
  db:
    image: postgres:16
    container_name: rallypoint-db
    environment:
      POSTGRES_USER: rallypoint
      POSTGRES_PASSWORD: rallypoint
      POSTGRES_DB: rallypoint
    ports: ["5432:5432"]
    volumes:
      - rallypoint_pg:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d
volumes:
  rallypoint_pg:
```
Create `docker/initdb/01-test-db.sql`: `CREATE DATABASE rallypoint_test;`
- [ ] **Step 5: `.env.example`** (and copy to `.env`):
```
DATABASE_URL="postgresql://rallypoint:rallypoint@localhost:5432/rallypoint?schema=public"
TEST_DATABASE_URL="postgresql://rallypoint:rallypoint@localhost:5432/rallypoint_test?schema=public"
JWT_SECRET="dev-secret-change-in-production"
APP_URL="http://localhost:3000"
NODE_ENV="development"
```
- [ ] **Step 6: `package.json` scripts.** Add: `"typecheck": "tsc --noEmit"`, `"db:generate": "prisma generate"`, `"db:migrate": "prisma migrate dev"`, `"db:deploy": "prisma migrate deploy"`, `"db:seed": "tsx prisma/seed.ts"`, `"db:studio": "prisma studio"`, `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 7: `vitest.config.ts`** — node environment, load `.env` via dotenv, `test.setupFiles` = `["./tests/setup.ts"]`, `test.fileParallelism: false` (DB tests share a schema; run serially), alias `@`→`src`.
- [ ] **Step 8: Tailwind tokens.** In `src/app/globals.css` (Tailwind 4 `@import "tailwindcss";` + `@theme`), define color tokens: `--color-brand-*` emerald ramp, `--color-accent` lime, `--color-ink` charcoal, radii, shadow. (Full token block in Task 9.)
- [ ] **Step 9: Verify.** `docker compose up -d`; `npm run typecheck`; `npm run build`. Expected: build succeeds with the default page.
- [ ] **Step 10: Commit** — `feat: scaffold Next 16 + Postgres + tooling`.

### Task 2: Prisma schema + generated client

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`

**Interfaces produced:** all Prisma models + enums; `prisma` singleton importable from `@/lib/prisma`.

- [ ] **Step 1: Write `prisma/schema.prisma`** (postgresql, output `../src/generated/prisma`):
```prisma
generator client { provider = "prisma-client-js"; output = "../src/generated/prisma" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { CUSTOMER OWNER STAFF ADMIN }
enum VenueStatus { DRAFT PENDING_REVIEW APPROVED REJECTED SUSPENDED }
enum BookingStatus { HELD PENDING_PAYMENT PAYMENT_SUBMITTED PENDING_CONFIRMATION CONFIRMED EXPIRED CANCELLED REJECTED COMPLETED }
enum PaymentChannel { GCASH MAYA BANK_TRANSFER CASH }
enum ExceptionType { MAINTENANCE HOLIDAY PRIVATE_EVENT CLOSURE TOURNAMENT }
enum ActorType { SYSTEM CUSTOMER OWNER STAFF ADMIN }
enum BookingSource { ONLINE WALK_IN }

model User {
  id String @id @default(cuid())
  email String @unique
  name String?
  mobile String?
  role Role @default(CUSTOMER)
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ownedVenues Venue[] @relation("VenueOwner")
  staffOf VenueStaff[]
  bookings Booking[]
  favorites Favorite[]
  reviews Review[]
  magicTokens MagicLinkToken[]
  notifications Notification[]
  @@map("users")
}
model MagicLinkToken {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String @unique
  expiresAt DateTime
  usedAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId])
  @@map("magic_link_tokens")
}
model Venue {
  id String @id @default(cuid())
  slug String @unique
  name String
  description String?
  addressLine String?
  barangay String?
  city String @default("Davao City")
  lat Float?
  lng Float?
  contactNumber String?
  website String?
  photos String[]
  amenities String[]
  houseRules String?
  status VenueStatus @default(DRAFT)
  isPublished Boolean @default(false)
  ratingAvg Float @default(0)
  ratingCount Int @default(0)
  ownerId String
  owner User @relation("VenueOwner", fields: [ownerId], references: [id])
  courts Court[]
  staff VenueStaff[]
  bookings Booking[]
  reviews Review[]
  favorites Favorite[]
  paymentMethods PaymentMethod[]
  verification VenueVerification?
  sentry SentryConnection?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([city, isPublished])
  @@map("venues")
}
model VenueStaff {
  id String @id @default(cuid())
  venueId String
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @default(STAFF)
  permissions String[]
  createdAt DateTime @default(now())
  @@unique([venueId, userId])
  @@map("venue_staff")
}
model Court {
  id String @id @default(cuid())
  venueId String
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name String
  indoor Boolean @default(true)
  covered Boolean @default(false)
  surface String?
  capacity Int @default(4)
  slotMinutes Int @default(60)
  priceCents Int
  active Boolean @default(true)
  sortOrder Int @default(0)
  schedules CourtSchedule[]
  exceptions ScheduleException[]
  bookings Booking[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([venueId])
  @@map("courts")
}
model CourtSchedule {
  id String @id @default(cuid())
  courtId String
  court Court @relation(fields: [courtId], references: [id], onDelete: Cascade)
  dayOfWeek Int
  openMinute Int
  closeMinute Int
  @@unique([courtId, dayOfWeek])
  @@map("court_schedules")
}
model ScheduleException {
  id String @id @default(cuid())
  courtId String
  court Court @relation(fields: [courtId], references: [id], onDelete: Cascade)
  startsAt DateTime
  endsAt DateTime
  type ExceptionType @default(MAINTENANCE)
  reason String?
  createdAt DateTime @default(now())
  @@index([courtId, startsAt])
  @@map("schedule_exceptions")
}
model Booking {
  id String @id @default(cuid())
  reference String @unique
  userId String?
  user User? @relation(fields: [userId], references: [id])
  venueId String
  venue Venue @relation(fields: [venueId], references: [id])
  courtId String
  court Court @relation(fields: [courtId], references: [id])
  startsAt DateTime
  endsAt DateTime
  status BookingStatus @default(HELD)
  holdExpiresAt DateTime?
  priceCents Int
  currency String @default("PHP")
  idempotencyKey String? @unique
  customerName String?
  customerMobile String?
  customerEmail String?
  source BookingSource @default(ONLINE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  payment PaymentSubmission?
  history BookingStatusHistory[]
  @@index([venueId, status])
  @@index([courtId, startsAt])
  @@index([userId])
  @@map("bookings")
}
model PaymentSubmission {
  id String @id @default(cuid())
  bookingId String @unique
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  paymentMethodId String?
  paymentMethod PaymentMethod? @relation(fields: [paymentMethodId], references: [id])
  channel PaymentChannel
  reference String
  proofKey String
  amountCents Int
  submittedAt DateTime @default(now())
  @@map("payment_submissions")
}
model PaymentMethod {
  id String @id @default(cuid())
  venueId String
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  channel PaymentChannel
  accountName String
  accountNumber String
  instructions String?
  active Boolean @default(true)
  sortOrder Int @default(0)
  submissions PaymentSubmission[]
  @@map("payment_methods")
}
model BookingStatusHistory {
  id String @id @default(cuid())
  bookingId String
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  fromStatus BookingStatus?
  toStatus BookingStatus
  actor ActorType @default(SYSTEM)
  actorId String?
  note String?
  at DateTime @default(now())
  @@index([bookingId, at])
  @@map("booking_status_history")
}
model Review {
  id String @id @default(cuid())
  venueId String
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  userId String
  user User @relation(fields: [userId], references: [id])
  bookingId String? @unique
  rating Int
  body String?
  ownerReply String?
  createdAt DateTime @default(now())
  @@index([venueId])
  @@map("reviews")
}
model Favorite {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  venueId String
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, venueId])
  @@map("favorites")
}
model Notification {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  type String
  title String
  body String?
  bookingId String?
  readAt DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
  @@map("notifications")
}
model VenueVerification {
  id String @id @default(cuid())
  venueId String @unique
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  status VenueStatus @default(PENDING_REVIEW)
  notes String?
  reviewedBy String?
  reviewedAt DateTime?
  createdAt DateTime @default(now())
  @@map("venue_verifications")
}
model SentryConnection {
  id String @id @default(cuid())
  venueId String @unique
  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  sentryBusinessRef String?
  encryptedApiKey String?
  entitlement String?
  connectionState String @default("DISCONNECTED")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("sentry_connections")
}
```
Note: `Booking.period` (tstzrange) is intentionally **not** modeled here — it is a DB-generated column added by raw SQL in Task 3. The client never reads it.
- [ ] **Step 2: `src/lib/prisma.ts`** — copy ledgerdex singleton, importing from `@/generated/prisma`.
- [ ] **Step 3: Generate + baseline migration.** `npm run db:migrate -- --name init`. Verify tables created.
- [ ] **Step 4: Commit** — `feat: prisma schema + client`.

### Task 3: `btree_gist` + generated `period` + EXCLUDE constraint migration

**Files:**
- Create: `prisma/migrations/<ts>_booking_exclusion/migration.sql` (via `--create-only`)

- [ ] **Step 1:** `npx prisma migrate dev --create-only --name booking_exclusion`. Replace the generated file's contents with:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD COLUMN "period" tstzrange
  GENERATED ALWAYS AS (tstzrange("startsAt", "endsAt", '[)')) STORED;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("courtId" WITH =, "period" WITH &&)
  WHERE ("status" IN ('HELD','PENDING_PAYMENT','PAYMENT_SUBMITTED','PENDING_CONFIRMATION','CONFIRMED'));
```
- [ ] **Step 2:** Apply: `npx prisma migrate dev`.
- [ ] **Step 3:** Verify constraint exists: `docker compose exec db psql -U rallypoint -d rallypoint -c "\d+ bookings"` shows `period` generated column + `bookings_no_overlap` exclusion constraint.
- [ ] **Step 4:** Drift guard — run `npx prisma migrate dev` again; expect "No schema changes." If it reports drift on `period`, add `period Unsupported("tstzrange")?` to the `Booking` model in `schema.prisma` and re-run; expect a no-op/empty diff. Document the outcome in the migration folder README.
- [ ] **Step 5: Commit** — `feat: DB-level double-booking EXCLUDE constraint`.

---

## Phase 2 — Core services (the critical backend)

### Task 4: Shared domain types + state machine

**Files:**
- Create: `src/lib/booking/status.ts`, `src/lib/booking/errors.ts`
- Test: `tests/booking/status.test.ts`

**Interfaces produced:**
- `OCCUPYING: BookingStatus[]`
- `canTransition(from: BookingStatus, to: BookingStatus): boolean`
- `assertTransition(from, to): void` (throws `InvalidTransitionError`)
- Errors: `SlotTakenError` (→409), `InvalidTransitionError` (→409), `HoldExpiredError` (→410), `NotFoundError` (→404), `ForbiddenError` (→403), `ValidationError` (→400)

- [ ] **Step 1: Write failing test** `tests/booking/status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canTransition, OCCUPYING } from "@/lib/booking/status";
describe("state machine", () => {
  it("allows HELD→PENDING_PAYMENT", () => expect(canTransition("HELD","PENDING_PAYMENT")).toBe(true));
  it("forbids HELD→CONFIRMED", () => expect(canTransition("HELD","CONFIRMED")).toBe(false));
  it("forbids CONFIRMED→HELD", () => expect(canTransition("CONFIRMED","HELD")).toBe(false));
  it("PENDING_CONFIRMATION→CONFIRMED and →REJECTED", () => {
    expect(canTransition("PENDING_CONFIRMATION","CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_CONFIRMATION","REJECTED")).toBe(true);
  });
  it("occupying set is exactly the five active statuses", () =>
    expect([...OCCUPYING].sort()).toEqual(["CONFIRMED","HELD","PAYMENT_SUBMITTED","PENDING_CONFIRMATION","PENDING_PAYMENT"]));
});
```
- [ ] **Step 2:** Run `npx vitest run tests/booking/status.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement `src/lib/booking/status.ts`:**
```ts
import type { BookingStatus } from "@/generated/prisma";
export const OCCUPYING: BookingStatus[] = ["HELD","PENDING_PAYMENT","PAYMENT_SUBMITTED","PENDING_CONFIRMATION","CONFIRMED"];
const T: Record<BookingStatus, BookingStatus[]> = {
  HELD: ["PENDING_PAYMENT","EXPIRED","CANCELLED"],
  PENDING_PAYMENT: ["PAYMENT_SUBMITTED","EXPIRED","CANCELLED"],
  PAYMENT_SUBMITTED: ["PENDING_CONFIRMATION","REJECTED","CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED","REJECTED","CANCELLED"],
  CONFIRMED: ["COMPLETED","CANCELLED"],
  EXPIRED: [], CANCELLED: [], REJECTED: [], COMPLETED: [],
};
export function canTransition(from: BookingStatus, to: BookingStatus) { return T[from]?.includes(to) ?? false; }
```
And `errors.ts` with the typed error classes above (each carries an `httpStatus`).
- [ ] **Step 4:** Run test — expect PASS.
- [ ] **Step 5: Commit** — `feat: booking state machine + domain errors`.

### Task 5: Seam interfaces — BookingBackend, PaymentProofStorage, EmailSender

**Files:**
- Create: `src/lib/booking/backend.ts` (interface + types), `src/lib/storage/proof-storage.ts` (interface), `src/lib/storage/local-fs-storage.ts`, `src/lib/email/sender.ts` (interface), `src/lib/email/dev-sender.ts`
- Test: `tests/storage/local-fs-storage.test.ts`

**Interfaces produced:**
```ts
// backend.ts
export interface HoldInput {
  venueId: string; courtId: string; startsAt: Date; endsAt: Date;
  priceCents: number; userId?: string; idempotencyKey?: string;
  source?: "ONLINE" | "WALK_IN";
  customer: { name?: string; mobile?: string; email?: string };
}
export interface Actor { type: "SYSTEM"|"CUSTOMER"|"OWNER"|"STAFF"|"ADMIN"; id?: string }
export interface BookingBackend {
  createHold(input: HoldInput): Promise<{ id: string; reference: string; holdExpiresAt: Date }>;
  submitDetails(bookingId: string, customer: HoldInput["customer"], actor: Actor): Promise<void>;
  submitPayment(bookingId: string, p: { channel: string; reference: string; proofKey: string; amountCents: number; paymentMethodId?: string }, actor: Actor): Promise<void>;
  confirm(bookingId: string, actor: Actor): Promise<void>;
  reject(bookingId: string, actor: Actor, note?: string): Promise<void>;
  cancel(bookingId: string, actor: Actor): Promise<void>;
  expireStale(now?: Date): Promise<number>;
  getOccupied(courtId: string, from: Date, to: Date): Promise<Array<{ startsAt: Date; endsAt: Date; status: string }>>;
}
// proof-storage.ts
export interface SavedProof { key: string }
export interface PaymentProofStorage {
  save(input: { bytes: Buffer; contentType: string }): Promise<SavedProof>;
  getBytes(key: string): Promise<{ bytes: Buffer; contentType: string }>;
}
// sender.ts
export interface EmailSender { sendMagicLink(to: string, url: string): Promise<void>; }
```

- [ ] **Step 1: Write failing test** for `LocalFsStorage` (save→getBytes round-trips, key stays under `uploads/payment-proofs/`, contentType preserved).
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3: Implement.** `LocalFsStorage.save` validates contentType ∈ {image/jpeg, image/png, image/webp}, writes `uploads/payment-proofs/<cuid>.<ext>`, returns `{ key }`; `getBytes` reads it. `DevConsoleSender.sendMagicLink` `console.log`s the URL and stores `{email→url}` in a module singleton exported as `lastMagicLinks` (dev-only; used by the dev banner route). Add `src/lib/storage/index.ts` + `src/lib/email/index.ts` exporting the chosen impl based on `NODE_ENV`.
- [ ] **Step 4:** Run test — PASS.
- [ ] **Step 5: Commit** — `feat: storage + email seams (local fs, dev email)`.

### Task 6: LocalBookingBackend — holds, transitions, expiry, idempotency, 23P01

**Files:**
- Create: `src/lib/booking/local-backend.ts`, `src/lib/booking/reference.ts`, `src/lib/db/pg-errors.ts`, `src/lib/booking/index.ts` (exports `bookingBackend`)
- Test: `tests/booking/local-backend.test.ts` (integration, Postgres)

**Interfaces consumed:** Task 4 (`OCCUPYING`, `canTransition`, errors), Task 5 (`BookingBackend`, `HoldInput`, `Actor`). **Produces:** `bookingBackend: BookingBackend` (LocalBookingBackend instance).

- [ ] **Step 1:** Write `tests/setup.ts`: point Prisma at `TEST_DATABASE_URL`, run `prisma migrate deploy` once, and provide `resetDb()` that `TRUNCATE`s all tables `RESTART IDENTITY CASCADE` in `beforeEach`.
- [ ] **Step 2: Write failing test** `local-backend.test.ts` covering: createHold inserts HELD with holdExpiresAt≈now+HOLD_MINUTES; overlapping createHold on same court/range throws `SlotTakenError`; adjacent (non-overlapping, `[)`) ranges both succeed; `submitDetails`/`submitPayment`/`confirm` walk the state machine and each append a `BookingStatusHistory` row; illegal transition throws `InvalidTransitionError`.
- [ ] **Step 3:** Run — expect FAIL.
- [ ] **Step 4: Implement `reference.ts`** — `newReference()` = `"RP-" + 6 chars base32` from `crypto.randomBytes`. **`pg-errors.ts`** — `isExclusionViolation(e)` (`code === "23P01"`), `isRetryable(e)` (`40001`/`40P01`), `withRetry(fn, n=3)`. **`local-backend.ts`:**
  - `createHold`: `withRetry` around a `prisma.$transaction` (READ COMMITTED): (a) if `idempotencyKey` set, return existing booking if found; (b) `UPDATE bookings SET status='EXPIRED' WHERE courtId=$ AND status IN ('HELD','PENDING_PAYMENT') AND holdExpiresAt < now()` + history rows for expired; (c) `INSERT` booking HELD with `holdExpiresAt = now()+HOLD_MINUTES`, generated `reference` (retry on reference unique clash); (d) insert `BookingStatusHistory(null→HELD)`. Wrap: catch `isExclusionViolation` → throw `SlotTakenError`; catch reference-unique → regenerate.
  - `submitDetails`/`submitPayment`/`confirm`/`reject`/`cancel`: load booking, `assertTransition`, for hold-phase also assert `holdExpiresAt > now()` else expire→throw `HoldExpiredError`, update status + write history, in one transaction. `submitPayment` also creates the `PaymentSubmission` row and then auto-advances `PAYMENT_SUBMITTED → PENDING_CONFIRMATION` (two history rows).
  - `expireStale`: bulk expire HELD/PENDING_PAYMENT past `holdExpiresAt`, return count.
  - `getOccupied`: select occupying bookings overlapping [from,to) on court.
  - `HOLD_MINUTES` from env (`HOLD_MINUTES`, default 10).
- [ ] **Step 5:** Run test — PASS.
- [ ] **Step 6: Commit** — `feat: LocalBookingBackend (holds, transitions, expiry, idempotency)`.

### Task 7: AvailabilityEngine

**Files:**
- Create: `src/lib/availability/engine.ts`, `src/lib/availability/cache.ts`
- Test: `tests/availability/engine.test.ts`

**Interfaces produced:**
```ts
export interface Slot { startsAt: Date; endsAt: Date; available: boolean; priceCents: number }
export function courtSlotsForDate(courtId: string, date: Date, opts?: { durationMinutes?: number }): Promise<Slot[]>;
export function venueAvailability(venueId: string, date: Date, opts?): Promise<{ courtId: string; slots: Slot[] }[]>;
export function searchAvailability(query: { city: string; date: Date; fromMinute?: number; toMinute?: number; durationMinutes?: number }): Promise<VenueSearchResult[]>;
```

- [ ] **Step 1: Write failing test:** given a court with Mon 08:00–22:00 schedule and one CONFIRMED booking 19:00–20:00, `courtSlotsForDate` on that Monday returns hourly slots with 19:00 marked unavailable and 18:00/20:00 available; a MAINTENANCE exception 12:00–14:00 marks those unavailable; a 120-min duration slot at 21:00 is unavailable (exceeds close); adjacency at close boundary respected.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement.** For `(court,date)`: read the court's `CourtSchedule` for that weekday → operating window; step by `slotMinutes`; for each candidate `[start, start+duration)` mark available iff fully inside the window, no overlapping `ScheduleException`, and no overlapping occupying `Booking` (via `bookingBackend.getOccupied`, treating expired-unswept HELD as free by filtering `holdExpiresAt`). `priceCents = pricePerHour * durationHours`. `searchAvailability` filters published+APPROVED venues in city, maps `venueAvailability`, computes `priceFrom` + next-free chips, wrapped in `cache.ts` (30–60s TTL in-memory `Map` keyed by query).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** — `feat: availability engine + search cache`.

### Task 8: Auth — magic-link + session + guards

**Files:**
- Create: `src/lib/auth/session.ts` (jose, adapted from ledgerdex), `src/lib/auth/magic-link.ts`, `src/lib/auth/guards.ts`
- Modify: `.env` already has `JWT_SECRET`
- Test: `tests/auth/magic-link.test.ts`

**Interfaces produced:** `signSession(payload)`, `getSession()`, `getSessionFromRequest(req)`, `setSessionCookie/clearSessionCookie`; `requestMagicLink(email)`, `consumeMagicToken(token) → session|null`; guards `requireUser()`, `requireRole(role)`, `assertVenueAccess(userId, venueId)` (owner or staff of that venue, or ADMIN; else `ForbiddenError`).

- [ ] **Step 1: Write failing test:** `requestMagicLink` creates a hashed token row + calls the dev sender; `consumeMagicToken` with the raw token returns a session and marks `usedAt`; re-using the same token returns null; expired token returns null; unknown token returns null.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement.** Session = jose HS256 like ledgerdex but payload `{ id, email, role }`, cookie `rallypoint_session`, 30-day expiry. Magic-link: generate raw token = `crypto.randomBytes(32).hex`; store `sha256(raw)` in `MagicLinkToken` with `expiresAt=now+15min`; url = `${APP_URL}/auth/verify?token=${raw}`; send via `EmailSender`. Consume: hash, look up unused+unexpired, mark used, upsert user by email (create CUSTOMER if new), return session payload.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** — `feat: magic-link auth + session + guards`.

---

## Phase 3 — Design system + shell

### Task 9: Tailwind tokens + primitives

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/lib/cn.ts`; `src/components/ui/{button,input,select,label,badge,card,modal,bottom-sheet,toast,skeleton,empty-state,error-state}.tsx`
- Test: `tests/components/button.test.tsx` (renders variants; disabled state)

**Contract:** Each primitive typed with `cva` variants. `Button` variants: `primary|secondary|ghost|danger`, sizes `sm|md|lg`, `loading` prop (spinner, disabled). `Badge` maps `BookingStatus`→color+label (e.g. `CONFIRMED`→emerald "Confirmed", `PENDING_CONFIRMATION`→amber "Awaiting venue"). `Modal`/`BottomSheet` = Radix Dialog; BottomSheet is the mobile presentation (`sm:` switches to centered modal). `Toast` = Radix Toast provider + `useToast()`.

- [ ] **Step 1: globals.css** — Tailwind 4 `@theme` tokens (emerald brand ramp 50–900, lime `--color-accent`, charcoal `--color-ink`, `--radius-card: 1rem`, soft shadow). Base: mobile-first, `min-h-dvh`, no horizontal overflow, focus-visible ring.
- [ ] **Step 2: `cn.ts`** = `twMerge(clsx(...))`.
- [ ] **Step 3:** Implement primitives (representative — Button):
```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
const button = cva("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: { primary: "bg-brand-600 text-white hover:bg-brand-700", secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100", ghost: "text-ink hover:bg-black/5", danger: "bg-red-600 text-white hover:bg-red-700" },
    size: { sm: "h-9 px-3 text-sm", md: "h-11 px-4", lg: "h-13 px-6 text-lg" },
  }, defaultVariants: { variant: "primary", size: "md" },
});
// ...forwardRef button, spinner when loading
```
- [ ] **Step 4: Write + run** the button test — PASS.
- [ ] **Step 5: Commit** — `feat: design system tokens + UI primitives`.

### Task 10: App shell + navigation + error/loading infra

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/app/(site)/layout.tsx` (player shell: top nav desktop, bottom tab bar mobile — Home/Explore/Bookings/Saved/Profile), `src/app/(owner)/layout.tsx` (owner shell), `src/components/nav/*`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/components/dev/MagicLinkBanner.tsx`, `src/app/api/dev/last-magic-link/route.ts`
- Test: n/a (visual) — verified in gate

- [ ] **Step 1:** Root layout: fonts, `<ToastProvider>`, `<html lang>`, metadata base. Dev-only `MagicLinkBanner` (renders only when `NODE_ENV!=="production"`, polls the dev route, shows the latest login link as a clickable button).
- [ ] **Step 2:** Player shell with responsive nav (sticky top on `md+`, fixed bottom tab bar on mobile with large tap targets). Owner shell with side/top nav.
- [ ] **Step 3:** `loading.tsx` (skeletons), `error.tsx` (ErrorState + retry), `not-found.tsx`.
- [ ] **Step 4:** dev route returns `lastMagicLinks` map (guard: 404 in production).
- [ ] **Step 5:** `npm run build` — PASS. **Commit** — `feat: app shell, nav, error/loading infra`.

---

## Phase 4 — Player UI + booking API

### Task 11: Auth routes + pages (login, verify, logout)

**Files:**
- Create: `src/app/api/auth/request/route.ts` (POST email → requestMagicLink), `src/app/api/auth/verify/route.ts` or `src/app/auth/verify/page.tsx` (GET token → consume → set cookie → redirect), `src/app/api/auth/logout/route.ts`, `src/app/(site)/login/page.tsx`
- Test: `tests/api/auth.test.ts` (request creates token; verify sets session; bad token rejected)

- [ ] Steps: failing test → implement route handlers using Task 8 → server-side validation (zod-free simple checks) → set httpOnly cookie via `setSessionCookie` → PASS → commit `feat: auth pages + routes`.

### Task 12: Booking API (intent endpoints) + idempotency + upload

**Files:**
- Create: `src/app/api/bookings/route.ts` (POST create hold), `src/app/api/bookings/[id]/details/route.ts`, `src/app/api/bookings/[id]/payment/route.ts` (multipart: proof upload via `PaymentProofStorage` + submit), `src/app/api/bookings/[id]/cancel/route.ts`, `src/app/api/proofs/[key]/route.ts` (authorized proof serving), `src/lib/http.ts` (error→response mapper)
- Test: `tests/api/bookings.test.ts` (create returns reference+holdExpiresAt; duplicate idempotencyKey returns same booking; overlapping returns 409; payment upload validates type/size; proof route denies non-owner/non-venue)

**Interfaces consumed:** `bookingBackend`, `paymentProofStorage`, guards. **Note:** create-hold reads `Idempotency-Key` header; recomputes `priceCents` **server-side** from the court + duration (never from client body). Uses `withRetry` semantics from Task 6.

- [ ] Steps: failing test → implement handlers with `http.ts` mapping domain errors to status codes (SlotTaken→409, HoldExpired→410, Forbidden→403, Validation→400) → multipart parsing via `await req.formData()` (Next 16), size ≤5MB, type allowlist → proof route checks session is booking's customer OR venue owner/staff OR admin → PASS → commit `feat: booking intent API + authorized proof upload/serving`.

### Task 13: Homepage + search (List-only)

**Files:**
- Create: `src/app/(site)/page.tsx` (hero + `SearchBar` + featured `VenueCard`s), `src/app/(site)/search/page.tsx` (RSC reads searchParams → `searchAvailability` → results list), `src/components/search/SearchBar.tsx`, `src/components/venue/VenueCard.tsx`, `src/components/ui/DatePicker.tsx`, `src/components/ui/TimeWindow.tsx`
- Test: n/a (verified in gate); optional RSC data-shape unit test

**Contract:** `SearchBar` fields: city (select), date (native date input styled), time window (from/to), duration (1/2/3 h). Submits to `/search?city=&date=&from=&to=&duration=`. `VenueCard` props: `{ venue, priceFromCents, nextSlots: Slot[] }` → photo, ⭐rating·count, name, 📍barangay·distance(optional), indoor/court count, `From ₱X/hour`, up-to-4 next-free slot chips linking into the venue page with slot preselected, `View Venue`. **No Map, no Map toggle.** Empty state when no availability (offer nearby times copy).

- [ ] Steps: implement → responsive check (cards 1-col mobile, grid desktop) → build → commit `feat: homepage + list search`.

### Task 14: Venue page + slot grid + booking panel

**Files:**
- Create: `src/app/(site)/venues/[slug]/page.tsx` (RSC: venue + courts + reviews + `venueAvailability` for selected date), `src/components/venue/Gallery.tsx`, `src/components/venue/Amenities.tsx`, `src/components/court/CourtCard.tsx`, `src/components/court/SlotGrid.tsx` (client: date switch, court→time→duration selection), `src/components/booking/BookingPanel.tsx` (sticky desktop / sticky bottom CTA mobile), `src/lib/seo.ts` (metadata + JSON-LD)
- Test: n/a (gate)

**Contract:** `SlotGrid` sequence DATE→COURT→TIME→DURATION→SUMMARY; slot chips show visual states (available/selected/unavailable). Selecting a slot + `Reserve` POSTs to `/api/bookings` with an `Idempotency-Key` (generated client-side per attempt) → on success routes to `/book/[reference]`. Metadata + canonical + OpenGraph + `SportsActivityLocation` JSON-LD for SEO (§48).

- [ ] Steps: implement → `generateMetadata` per venue → build → commit `feat: venue page, slot grid, booking panel, SEO`.

### Task 15: Booking flow pages — details, payment, status, my bookings

**Files:**
- Create: `src/app/(site)/book/[reference]/page.tsx` (router by status: details form if HELD, payment step if PENDING_PAYMENT, else redirect to status), `src/components/booking/DetailsForm.tsx`, `src/components/booking/PaymentStep.tsx` (venue channels + amount + reference input + screenshot upload + hold countdown), `src/components/booking/HoldCountdown.tsx` (client; server `holdExpiresAt` authoritative — computes remaining from server value, survives refresh, does not reset), `src/app/(site)/bookings/[reference]/page.tsx` (permanent status page: ref, venue, court, date/time, amount, payment status, booking status, venue contact, cancellation copy, `BookingStatus` badge, status history timeline), `src/app/(site)/bookings/page.tsx` (My bookings: upcoming/past, resume unpaid holds), `src/components/booking/StatusTimeline.tsx`, `src/components/payment/PaymentCard.tsx`, `src/components/booking/BookingSummary.tsx`
- Test: n/a for UI; countdown logic unit test `tests/components/hold-countdown.test.ts` (remaining derives from server timestamp; never increases on remount)

**Contract:** `HoldCountdown` takes `expiresAt: string` (ISO) and renders `mm:ss` from `expiresAt - Date.now()`, updating each second; on expiry shows "Your hold expired" + `Find Another Court` CTA. Payment step uploads via Task 12 multipart endpoint; on submit the booking becomes `PAYMENT_SUBMITTED`→`PENDING_CONFIRMATION` and routes to the status page. Status page RSC re-reads on load; shows the §16 layout and the §41 audit timeline.

- [ ] Steps: implement → verify refresh doesn't reset timer (read from server) → build → commit `feat: booking flow (details, payment, status, my bookings)`.

---

## Phase 5 — Owner confirm side

### Task 16: Owner reservations + confirm/reject

**Files:**
- Create: `src/app/(owner)/owner/page.tsx` (redirect to reservations), `src/app/(owner)/owner/reservations/page.tsx` (RSC: bookings for the owner's venue(s), filter by status via searchParams), `src/app/(owner)/owner/reservations/[reference]/page.tsx` (detail + payment-proof viewer + Confirm/Reject), `src/app/api/owner/bookings/[id]/confirm/route.ts`, `src/app/api/owner/bookings/[id]/reject/route.ts`, `src/components/owner/ReservationRow.tsx`, `src/components/owner/ProofViewer.tsx`
- Test: `tests/api/owner-confirm.test.ts` — **REQUIRED:** owner can confirm own venue's booking; **owner cannot confirm a booking belonging to another venue (403)**; confirm writes history CONFIRMED; reject writes REJECTED.

**Interfaces consumed:** `bookingBackend.confirm/reject`, `assertVenueAccess`, proof serving route. Confirm/reject handlers call `assertVenueAccess(session.id, booking.venueId)` before acting.

- [ ] Steps: failing test (incl. cross-venue 403) → implement guarded handlers + pages → ProofViewer streams via `/api/proofs/[key]` (owner authorized) → PASS → build → commit `feat: owner reservations + confirm/reject`.

---

## Phase 6 — Seed

### Task 17: Seed script

**Files:**
- Create: `prisma/seed.ts`, `public/seed/*` (or reuse remote placeholder image URLs), `tsconfig.seed.json` if needed
- Test: n/a (its output is exercised by e2e + manual gate)

- [ ] **Step 1:** Seed: 1 ADMIN (`admin@rallypoint.test`), 1 OWNER (`owner@rallypoint.test`) owning "Rally Court Davao", 1 CUSTOMER (`player@rallypoint.test`); 3–5 Davao venues (APPROVED + published, barangays: Buhangin, Matina, Lanang, etc.) each with 2–4 courts, weekday `CourtSchedule` (e.g. Mon–Thu 08:00–22:00, Fri 08:00–23:00, Sat 07:00–23:00, Sun 07:00–22:00), `PaymentMethod`s (GCash + Maya), a couple of `Review`s; the owner's venue gets a `VenueVerification(APPROVED)`. Idempotent via `upsert` on `slug`/`email`.
- [ ] **Step 2:** Run `npm run db:seed`; verify search returns venues and the owner login surfaces reservations after a test booking.
- [ ] **Step 3: Commit** — `feat: Davao seed data`.

---

## Phase 7 — Required tests + hardening

### Task 18: The five required tests (+ availability/authz coverage)

**Files:**
- Create/confirm: `tests/booking/concurrency.test.ts`, `tests/booking/idempotency.test.ts`, `tests/booking/expiry.test.ts`, `tests/booking/occupancy.test.ts`, `tests/api/owner-confirm.test.ts` (from Task 16), `tests/availability/engine.test.ts` (from Task 7), `tests/api/authz.test.ts`

**Required, named:**
1. **Concurrent booking → exactly one succeeds:**
```ts
it("exactly one of N concurrent holds on the same slot wins", async () => {
  const { courtId, venueId, startsAt, endsAt, priceCents } = await seedOneCourtSlot();
  const attempts = Array.from({ length: 8 }, () =>
    bookingBackend.createHold({ venueId, courtId, startsAt, endsAt, priceCents, customer: {} })
      .then(() => "ok").catch((e) => e.constructor.name));
  const results = await Promise.all(attempts);
  expect(results.filter((r) => r === "ok")).toHaveLength(1);
  expect(results.filter((r) => r === "SlotTakenError")).toHaveLength(7);
  const rows = await prisma.booking.count({ where: { courtId, status: { in: OCCUPYING } } });
  expect(rows).toBe(1);
});
```
2. **Idempotent retry returns same booking, no duplicate:**
```ts
it("same idempotencyKey returns the same booking", async () => {
  const s = await seedOneCourtSlot(); const key = "idem-123";
  const a = await bookingBackend.createHold({ ...s, idempotencyKey: key, customer: {} });
  const b = await bookingBackend.createHold({ ...s, idempotencyKey: key, customer: {} });
  expect(b.id).toBe(a.id);
  expect(await prisma.booking.count({ where: { courtId: s.courtId } })).toBe(1);
});
```
3. **Expired hold frees the slot:**
```ts
it("an expired hold releases the slot for a new booking", async () => {
  const s = await seedOneCourtSlot();
  const first = await bookingBackend.createHold({ ...s, customer: {} });
  await prisma.booking.update({ where: { id: first.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
  const second = await bookingBackend.createHold({ ...s, customer: {} }); // triggers stale-expire then insert
  expect(second.id).not.toBe(first.id);
  expect((await prisma.booking.findUnique({ where: { id: first.id } }))!.status).toBe("EXPIRED");
});
```
4. **Payment-pending booking still blocks the slot:**
```ts
it.each(["PENDING_PAYMENT","PAYMENT_SUBMITTED","PENDING_CONFIRMATION"])("a %s booking blocks the slot", async (status) => {
  const s = await seedOneCourtSlot();
  const b = await bookingBackend.createHold({ ...s, customer: {} });
  await prisma.booking.update({ where: { id: b.id }, data: { status, holdExpiresAt: null } });
  await expect(bookingBackend.createHold({ ...s, customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
});
```
5. **Owner cannot confirm another venue's booking:** (in Task 16 file) assert the confirm handler / `assertVenueAccess` throws `ForbiddenError` (403) when the session owner does not own the booking's venue, and the booking status is unchanged.

- [ ] Steps: write each, run to fail, ensure the Task 6/7/16 implementations make them pass, keep `fileParallelism:false`. Commit `test: required booking race/authz/occupancy suite`.

### Task 19: Verification gate

- [ ] `docker compose up -d` running.
- [ ] `npm run db:deploy` (or migrate) on the dev DB; `npm run db:seed`.
- [ ] `npm run typecheck` — 0 errors.
- [ ] `npm run lint` — 0 errors.
- [ ] `npm run test` — all green (esp. the five required).
- [ ] `npm run build` — production build succeeds.
- [ ] Manual e2e once: login as player → search Davao → open venue → pick court/time/duration → reserve (HELD, countdown) → submit payment proof → status `PENDING_CONFIRMATION` → login as owner → see reservation → view proof → Confirm → status `CONFIRMED` on the player status page.
- [ ] Commit any fixes; final commit `chore: thin-slice verification gate green`.

---

## Self-Review

**Spec coverage:** §1–5 trust/roles → auth roles + guards + trust copy (Tasks 8/10/14/15). §6–9 discovery/search/cards → Tasks 13/14 (List-only per amendment). §11–16 court selection/state machine/hold/double-booking/flow/detail → Tasks 4/6/12/14/15. §17–19 account/favorites/reviews → auth + data model (favorites/reviews seeded, write-UI deferred per amendment). §20–36 owner/admin → confirm-side only (Task 16); rest deferred per amendment (data model present). §37 Sentry → `SentryConnection` model + `BookingBackend` seam, connector deferred. §38 multi-venue search+cache → Task 7. §39 data ownership/proof-as-evidence → PaymentSubmission (proofKey, not truth). §40 data model → Task 2 (with deviation #1). §41 audit → BookingStatusHistory. §42 security → guards, server-authoritative price/status, upload validation, idempotency, EXCLUDE. §43–44 mobile-first → shell + components. §45–47 design system/visual/Airbnb principles → Phase 3. §48 SEO → Task 14. §49 perf → RSC + cache + skeletons. §50 error states → Task 10 + empty states. §51 a11y → semantic + focus + labels in primitives. §52 MVP boundary / §53 don't-build → deferred list honored. §54 first launch Davao → seed. §56 tests → Task 18. §57–58 acceptance/DoD → Task 19.

**Placeholder scan:** none — engines, migration SQL, five tests, and interfaces are concrete; UI tasks carry explicit file lists + contracts + representative code.

**Type consistency:** `OCCUPYING`, `canTransition`, `BookingBackend`, `HoldInput`, `Actor`, `PaymentProofStorage`, `EmailSender`, `Slot` signatures are defined once (Tasks 4/5/7) and referenced by exact name thereafter. Booking statuses match the Prisma enum in Task 2.

**Deferred-but-modeled:** VenueStaff, Favorite, Notification, VenueVerification, SentryConnection, ScheduleException(as data) exist in schema without UI — intentional per amendments.
