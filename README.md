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
shadcn/ui (Radix) · Payload CMS · `jose` (sessions) · Vitest.

## Design

[DESIGN.md](DESIGN.md) documents the teal/green palette, typography, component
tokens, and motion. Shared shadcn primitives live in `src/components/ui`; their
semantic theme and reduced-motion rules live in `src/app/globals.css`.

## Prerequisites

- Node 20.9+ (developed on 24)
- Docker Desktop (for PostgreSQL)

## Setup

```bash
npm install
cp .env.example .env            # already present; adjust if needed
docker compose up -d            # Postgres 16 on host port 15432
npm run db:deploy               # apply migrations (incl. the EXCLUDE constraint)
npm run db:generate             # generate the Prisma client
npm run db:seed                 # 5 Davao venues + demo accounts
npm run cms:migrate             # Payload tables in the separate cms schema
npm run cms:seed                # current marketing copy; preserves saved edits
npm run dev                     # http://localhost:3000
```

> **Postgres runs on host port `15432`** (5432/5433 are used by other local
> Postgres instances on this machine). This avoids the Windows-reserved port
> range that can block `55432`. The connection string lives in `.env`.

Set `PAYLOAD_SECRET` in `.env` to a random secret before running CMS commands.
Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Keep this value private and stable across deployments.

## Signing in (dev)

Auth is passwordless magic-link. In development there's **no SMTP** — instead a
yellow banner appears at the top of the app with the latest sign-in link (also
printed to the server console). Request a link from `/login`, then click the
banner.

Seeded accounts:

| Role     | Email                    |
| -------- | ------------------------ |
| Customer | `player@rallypoint.test` |
| Owner    | `owner@rallypoint.test`  |
| Admin    | `admin@rallypoint.test`  |

The owner owns all seeded venues (so the confirm flow works from any booking).

## Editing website content

Open **[/cms](http://localhost:3000/cms)** and sign in with an existing RallyPoint
admin account. In development use `admin@rallypoint.test` and open the magic link
from the banner. **Edit website** links also appear in the admin navigation.

- **Homepage:** hero text, links, venue-section copy, how-it-works steps, and the
  venue-owner call to action.
- **Header & footer:** navigation labels, tagline, footer links, and the
  **Powered by Code Box Studios** credit.
- **Venue landing page:** headline, description, button labels, and benefits.

Choose **Save Draft** to keep changes private. Choose **Publish changes**, then
refresh the website to see them. The editor retains the last 30 versions.
Court availability, venue photos, bookings, pricing, and payments still use the
existing venue management workflows.

Payload uses Postgres schema `cms`; Prisma owns `public`. `CMS_DATABASE_URL` is
optional if you prefer a separate CMS database. Both databases need migrations.
Production setup runs `npm run db:deploy`, `npm run cms:migrate`, and
`npm run cms:seed` **before** starting the app. Seeding only creates missing
content and can be repeated safely. Public pages use published content; if CMS
configuration is absent or unavailable they show the built-in copy and log
load failures. Public reads have a two-second deadline and exclude unpublished
content. The CMS itself requires a working database and secret.

After changing CMS fields, run `npm run cms:types`, `npm run cms:importmap`, and
`npm run cms:migrate:create -- --name describe-the-change`. Review and commit
the generated migration, then apply it with `npm run cms:migrate`.

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
CMS tests also cover private drafts, published content, anonymous access,
admin-role revocation, repeat seeding, and safe login return paths. The suite
applies both Prisma and CMS migrations to `TEST_DATABASE_URL`.

## Scripts

| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Dev server                                |
| `npm run build`     | Production build and standalone assets    |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm run lint`      | ESLint                                    |
| `npm test`          | Vitest suite                              |
| `npm run db:deploy` | Apply committed migrations (**use this**) |
| `npm run db:seed`   | Seed demo data                            |
| `npm run db:studio` | Prisma Studio                             |
| `npm run cms:migrate` | Apply committed CMS migrations          |
| `npm run cms:seed` | Create missing marketing content           |
| `npm run cms:types` | Generate Payload TypeScript types         |
| `npm run cms:importmap` | Generate editor component imports     |

> Apply migrations with **`db:deploy`**, not `prisma migrate dev` — the
> `bookings.period` generated column + EXCLUDE constraint make `migrate dev`
> report benign drift. See [`prisma/migrations/README.md`](prisma/migrations/README.md).

## Deferred (extensible, not built in this slice)

Owner onboarding wizard, admin verification UI, favorites, review writing,
notification delivery, owner calendar, walk-ins & court blocking UI, staff
management, interactive map, and the **Sentry connector** — the `BookingBackend`
seam, `SentryConnection` model, `PaymentProofStorage`, and `EmailSender`
interfaces are all in place for these.
