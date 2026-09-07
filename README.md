# RallyPoint

A web-only **marketplace for pickleball courts** in Davao — players discover
venues, see real availability, hold a court, pay the venue, and track
confirmation. Venue owners receive reservations and confirm payments.

This repo is the **end-to-end thin slice**: one complete vertical
(discover → reserve → pay → confirm) built on a real booking engine with
database-level double-booking protection. See
[`docs/superpowers/specs/2026-09-07-rallypoint-thin-slice-design.md`](docs/superpowers/specs/2026-09-07-rallypoint-thin-slice-design.md)
for the design and
[`docs/superpowers/plans/2026-09-07-rallypoint-thin-slice.md`](docs/superpowers/plans/2026-09-07-rallypoint-thin-slice.md)
for the plan.

## Stack

Next.js 16 (App Router) · TypeScript · Prisma · PostgreSQL 16 · Tailwind CSS 4 ·
Radix UI · `jose` (sessions) · Vitest.

## Prerequisites

- Node 20+ (developed on 24)
- Docker Desktop (for PostgreSQL)

## Setup

```bash
npm install
cp .env.example .env            # already present; adjust if needed
docker compose up -d            # Postgres 16 on host port 55432
npm run db:deploy               # apply migrations (incl. the EXCLUDE constraint)
npm run db:generate             # generate the Prisma client
npm run db:seed                 # 5 Davao venues + demo accounts
npm run dev                     # http://localhost:3000
```

> **Postgres runs on host port `55432`** (5432/5433 are used by other local
> Postgres instances on this machine). The connection string lives in `.env`.

## Signing in (dev)

Auth is passwordless magic-link. In development there's **no SMTP** — instead a
yellow banner appears at the top of the app with the latest sign-in link (also
printed to the server console). Request a link from `/login`, then click the
banner.

Seeded accounts:

| Role     | Email                      |
| -------- | -------------------------- |
| Customer | `player@rallypoint.test`   |
| Owner    | `owner@rallypoint.test`    |
| Admin    | `admin@rallypoint.test`    |

The owner owns all seeded venues (so the confirm flow works from any booking).

## The core journey

1. Search Davao → open a venue → pick a court, time, and duration.
2. **Reserve** → the court is `HELD` with a server-authoritative countdown.
3. Enter details → **pay the venue** (GCash/Maya) and upload a screenshot.
4. Booking becomes `PENDING_CONFIRMATION`.
5. Sign in as the owner → **Reservations** → review the proof → **Confirm**.
6. The booking is `CONFIRMED`; the player sees it on their status page.

## Double-booking guarantee

A booking occupies `(court, [startsAt, endsAt))`. A Postgres `EXCLUDE`
constraint (`btree_gist`) forbids overlapping periods on the same court across
all occupying statuses (`HELD, PENDING_PAYMENT, PAYMENT_SUBMITTED,
PENDING_CONFIRMATION, CONFIRMED`). Concurrency, retries, and refreshes cannot
double-book — the database rejects the overlap (`23P01`), which the API maps to
HTTP 409. Idempotency keys dedupe replays. A hold is simply a `Booking` in
`HELD` state with a `holdExpiresAt`, so online bookings and (future) walk-ins
share one occupancy model.

## Tests

```bash
npm test          # Vitest against the rallypoint_test database (auto-migrated)
```

Covers the state machine, concurrent-hold races (exactly one wins), idempotent
retries, hold expiry, occupancy, availability, magic-link auth, storage, and
authorization (owner cannot confirm another venue's booking; cross-user booking
reads denied).

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server                                    |
| `npm run build`     | Production build                              |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run lint`      | ESLint                                        |
| `npm test`          | Vitest suite                                  |
| `npm run db:deploy` | Apply committed migrations (**use this**)     |
| `npm run db:seed`   | Seed demo data                                |
| `npm run db:studio` | Prisma Studio                                 |

> Apply migrations with **`db:deploy`**, not `prisma migrate dev` — the
> `bookings.period` generated column + EXCLUDE constraint make `migrate dev`
> report benign drift. See [`prisma/migrations/README.md`](prisma/migrations/README.md).

## Deferred (extensible, not built in this slice)

Owner onboarding wizard, admin verification UI, favorites, review writing,
notification delivery, owner calendar, walk-ins & court blocking UI, staff
management, interactive map, and the **Sentry connector** — the `BookingBackend`
seam, `SentryConnection` model, `PaymentProofStorage`, and `EmailSender`
interfaces are all in place for these.
