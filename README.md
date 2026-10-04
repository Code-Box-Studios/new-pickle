# Pikol

A responsive, installable **marketplace for pickleball courts** — players discover
venues, see real availability, hold a court, pay the venue, and track
confirmation. Venue owners receive reservations and confirm payments.

**Live website:** [pikol-ph.vercel.app](https://pikol-ph.vercel.app).
Production connects to Supabase and runs with `APP_PREVIEW_MODE=false`, exposing
the sign-in and sign-up forms. Email delivery requires Supabase's email templates,
redirect settings, and SMTP configuration; phone sign-in requires its Phone
provider and SMS configuration. See [the deployment guide](docs/deployment/supabase.md).
Local development also defaults to full app mode.

This repo is the **end-to-end thin slice**: one complete vertical
(discover → reserve → pay → confirm) built on a real booking engine with
database-level double-booking protection. See
[`docs/superpowers/specs/2026-09-07-rallypoint-thin-slice-design.md`](docs/superpowers/specs/2026-09-07-rallypoint-thin-slice-design.md)
for the design and
[`docs/superpowers/plans/2026-09-07-rallypoint-thin-slice.md`](docs/superpowers/plans/2026-09-07-rallypoint-thin-slice.md)
for the plan.

## Stack

Next.js 16 (App Router) · TypeScript · Prisma · PostgreSQL 16 · Tailwind CSS 4 ·
shadcn/ui (Radix) · Payload CMS · Supabase Auth/Storage · Vitest.
The city combobox uses `cmdk`; the calendar uses React DayPicker.

## Design

[DESIGN.md](DESIGN.md) documents the teal/green palette, typography, component
tokens, and motion. Shared shadcn primitives live in `src/components/ui`; their
semantic theme and reduced-motion rules live in `src/app/globals.css`.

The homepage hero features Pikol's own paddle-and-ball logo and decorative
brand illustration, independent of venue listings. Venues appear in the separate
**Popular venues** section. Its custom wordmark uses a pickleball for the “o”,
with the logo's white ball rallying between the paddles, returning to the logo,
and repeating. Paddle returns and soft glow accompany the loop. The panel includes
a pause button; motion also pauses offscreen and in background tabs. Reduced-motion
preferences show a still composition. On Home, sign-in, sign-up, and venue onboarding,
the header is transparent over the dark intro, then fades into a floating white
panel as you scroll. White-content pages keep the white panel. Green search
actions and a branded mobile drawer remain available. It has no tagline; the
footer credits **Code Box Studios**.

Shared shadcn buttons use green primary pills, mint secondary actions, refined
outlines, and quiet ghost/link variants. A light sweep, subtle lift, directional
arrows, and quick press feedback add motion; disabled and loading actions stay
still, and reduced-motion preferences remove decorative movement.

Venue pages place booking ahead of long venue details on phones. Players can
browse photos in a shadcn viewer, choose any future day with the calendar,
filter start times by midnight/morning/afternoon/evening, and compare session totals.
The floating summary shows the full time range and can be cleared. Changing
the day or duration clears the previous slot so the summary stays accurate.
Sessions support **1–12 hours** where the court's schedule has a continuous
opening. Pick one start time for the whole session: it creates one reservation
and one checkout for the total, rather than separate bookings for each hour.

Date fields use the shared shadcn **Calendar + Popover** picker, including owner
rescheduling. They display readable dates and submit `YYYY-MM-DD` civil dates
without shifting the selected day through UTC conversion.

### Venue setup

The owner workspace guides venues through Details, Photos, Courts, Hours,
Payments, and Review. The setup rail shows how many of the five required sections
are ready; the final review step submits the venue for verification.
Phones and tablets use a compact current-step chooser with all six destinations
instead of a scrolling tab rail. Shorter headings keep the form within reach.
Details are grouped into identity, location, amenities, and house rules. A live
listing preview appears on wider screens. **Save draft** keeps owners on the
current form; **Save & continue** (labeled **Continue** on phones) moves to photos
after a successful save.
Failed saves retain entered fields and show an inline error. Save controls stay
in a slim two-button bar above mobile navigation, with space reserved below the
form so the last fields remain visible. Photo uploads and empty steps include
guidance, with consistent Back/Continue actions throughout setup.

The setup city picker also searches all 149 Philippine cities. Other cities or
municipalities can be entered manually. Changing the city clears the previous
barangay; locations without a curated barangay list use a text field.

Court owners can keep a flat hourly price or enable **time based rates** in the
Courts step. Midnight, morning, afternoon and evening have editable start/end
times and hourly prices. Overlapping bands are rejected; uncovered time uses
the base rate. A booking crossing bands combines each portion's price into one
total, rounded once to whole centavos. Existing reservations retain their saved
price. Connected Sentry courts keep their synced pricing rather than local
overrides. Apply the additive `20261004082500_court_time_rates` Prisma migration
before deploying this version against an existing database.

### Navigation performance

Vercel functions run in Seoul (`icn1`) to match the current Supabase database
region. Change `vercel.json` if moving the database. Verified sessions and
owner venue loads are deduplicated within a server render; ownership, active
user, and role checks still run on every request. A shared Pikol loading animation
shows two paddles rallying a ball while server pages load. It uses SVG and CSS,
with a still illustration for reduced-motion preferences.

## Nationwide city search

Court search puts **location, date and Find courts** first, with one-tap Today,
Tomorrow and This weekend choices based on Philippine dates. Time and duration
are optional shadcn controls; selected filters remain visible and can be reset.
Results stream beneath the available form with Pikol's paddle loader, and search
results retain the chosen duration when opening a venue. Local availability
loads schedules, blocks and reservations in batches instead of per court; the
booking API still revalidates every selected slot before creating a hold.

**Current location** fills the nearest city after browser permission;
**Near me** searches that city with the current date, time and duration.
Suggested nearby cities search in one tap. Before location access, suggestions
are based on the selected city. Denied/unavailable location leaves manual
search usable. No location request runs automatically. Only nearby city names
are cached in browser session storage for five minutes; precise coordinates
stay in memory and are not sent to Pikol or a geocoding service.
Proximity uses approximate city centers within 100 km, rather than court
distances, driving routes or city boundary detection. Cities without published
venues can still be suggested.

The bundled coordinate snapshot in
`src/lib/data/philippine-city-coordinates.json` covers the 149 city choices.
Coordinates are adapted from the [GeoNames Philippines gazetteer](https://download.geonames.org/export/dump/PH.zip),
retrieved on 2026-10-04, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Matching uses city/province names and GeoNames IDs to distinguish duplicate
names. GeoNames supplies approximate place points without an accuracy warranty;
see its [data documentation](https://download.geonames.org/export/dump/readme.txt).

The homepage and search page offer a searchable catalog of all **149 Philippine
cities**, including locations without published venues. Search accepts city or
province names and unaccented names such as `paranaque`. Duplicate city names
include the province in their search value. The default remains **Davao City**.
Existing published venue location strings are retained for compatibility.

The city names and current PSGC codes come from the
[Philippine Statistics Authority's city list](https://psa.gov.ph/classification/psgc/cities),
verified on **2026-10-02**. Province context is supplemented by the
[PSGC API dataset](https://psgc.gitlab.io/api/). The bundled snapshot lives in
`src/lib/data/philippine-cities.json`; there are no runtime calls to these sources.
PSA data is licensed under [CC BY 4.0](https://psa.gov.ph/terms-of-use).
Update the snapshot when the PSGC city list changes, retaining unique search
values for duplicate names. Venue locations currently store text rather than
PSGC codes; enter the catalog value when listing a venue in a duplicate-name city.

The demo seeds still contain five Davao venues. Selecting another city shows
**No venues here yet** until a venue there is published and approved.

## Prerequisites

- Node 22+ (developed on 24; Supabase requires native WebSocket support)
- Supabase project (PostgreSQL, Auth, Storage)
- Docker Desktop for the isolated local test database

## Supabase setup

See [the Supabase deployment guide](docs/deployment/supabase.md) for database
connections, migrations, email templates, SMTP, phone OTP, private uploads,
existing-data transfer, and hosting. Use `DATABASE_URL` for Prisma runtime,
`DIRECT_URL` for migrations, and a session/direct `CMS_DATABASE_URL` for Payload.
Supabase Auth requires the project URL and publishable key. Uploads require a
server-only secret key and the private `pikol-uploads` bucket.

## Local development

```bash
npm install
cp .env.example .env            # add real Supabase settings to .env.local
docker compose up -d            # Postgres 16 on host port 15432
npm run db:deploy               # apply migrations (incl. the EXCLUDE constraint)
npm run db:generate             # generate the Prisma client
npm run db:seed                 # optional LOCAL demo data only
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

## Sign-in and account creation

`/login` and `/signup` share a responsive Pikol layout, with a branded introduction
on desktop and a focused form on phones. Both offer **Email** and **Phone number**
tabs. **Email and password** is the default for players and venue owners; email
links and phone verification remain available. New password accounts confirm
their email before receiving access. Links between the pages preserve the booking
destination, and verification screens let players correct their contact details.

**Forgot password?** opens `/forgot-password`. Existing email-link accounts can
also use it to set their first password. A single-use verified email link opens
`/reset-password`; owners still complete their authenticator step before changing
their password. Supabase stores passwords, never Pikol's application database.

### Venue workspace security

Venue owners have a dedicated entry at **`/owner/login`**. Password, email-link or
phone sign-in is followed by a **TOTP authenticator code** at `/owner/verify`.
Owners, staff and administrators must complete this second step before private
pages, media or APIs receive an authenticated application session. First-time
owners set up an authenticator with a QR code or a manual setup key; existing
owners enter the latest code. Player accounts keep their normal sign-in flow.

The server verifies Supabase identity, current database permissions, AAL2,
the TOTP authentication method and a currently verified authenticator. Revoked
roles, inactive users, deleted factors and failed assurance checks deny access.
MFA runs through same-origin server routes with HttpOnly cookies; access and
refresh tokens are never returned to browser JavaScript. Supabase supplies
verification rate limits. No additional database migration is needed.

**Lost-device recovery:** an operator must independently verify the owner's
identity before resetting a factor in Supabase administration. An email link
does not bypass MFA. Do not remove factors merely because an unauthenticated
person supplies a venue name or email. Existing owners will be asked to set up
an authenticator when first entering the workspace after this update.

### Supabase authentication

Passwords, email magic links and six-digit Philippine phone OTPs are managed
by Supabase. Configure the **Magic Link** and **Confirm signup** email templates
from `supabase/templates/magic-link.html`; Pikol's callback verifies the token
hash and retains the booking return path. Set Site URL and redirect allowlists
in Supabase. Password recovery reuses the verified Magic Link template; no
additional recovery template or environment variable is required. Custom SMTP
is needed for real email recipients; phone sign-in
requires enabling the Phone provider and configuring a paid SMS service in
Supabase. Dashboard test phone numbers can be used during development.

There are no application-issued JWT sessions, development magic-link banners,
or displayed local SMS codes. Sessions use HttpOnly Supabase SSR cookies and
Next.js 16 `proxy.ts` refresh. Supabase verifies the identity; current roles and
active status are read from Pikol's `users` table. Existing user IDs and bookings
are preserved when a verified Supabase identity is first linked. Booking contact
numbers never act as verified login identities; conflicting accounts are not
merged automatically. New users receive the `CUSTOMER` role.

For CMS access, sign up with a working email and promote that verified Pikol
user to `ADMIN` using the SQL in the deployment guide. Demo `.test` accounts
cannot receive hosted email; use a local Supabase inbox or real addresses.

## Installing on a phone

Pikol is a Progressive Web App. **Install Pikol** in the footer opens
the browser's install prompt when available, or platform instructions. Android
supports installation through Chrome/Edge; on iPhone open Safari and choose
Share → Add to Home Screen. The installed site opens in its own window.

Production needs HTTPS (localhost also works). The service worker registers in
production and caches only the static reconnect screen and brand assets. Live
court availability, bookings, sign-in, CMS, payments, and private content stay
on the network. Offline navigation shows a reconnect screen. Run `pnpm build`
then `pnpm start` to test installation locally.

## pnpm development

`pnpm install` installs dependencies; `pnpm run dev` starts the app. pnpm 12
defaults to auto-installing stale dependencies before scripts. This project's
`pnpm-workspace.yaml` uses `verifyDepsBeforeRun: warn` so scripts don't install
packages implicitly, and explicitly allows the required native package builds.
After changing dependencies, run `pnpm install`, then `pnpm run db:generate`.
Use one package manager consistently for your local `node_modules`.

## Editing website content

Open **[/cms](http://localhost:3000/cms)** and sign in with an existing Pikol
admin account authenticated through Supabase. Promote your verified email
account to `ADMIN` as described in the deployment guide. **Edit website** links also appear in the admin navigation.

- **Homepage:** hero text, links, venue-section copy, how-it-works steps, and the
  venue-owner call to action.
- **Header & footer:** navigation labels, footer tagline, footer links, and the
  **Powered by Code Box Studios** credit.
- **Venue landing page:** headline, description, button labels, and benefits.

Choose **Save Draft** to keep changes private. Choose **Publish changes**, then
refresh the website to see them. The editor retains the last 30 versions.
Court availability, venue photos, bookings, pricing, and payments still use the
existing venue management workflows.

Payload uses Postgres schema `cms`; Prisma owns `public`. `CMS_DATABASE_URL` defaults to `DIRECT_URL`; both use a direct/session connection.
Use a separate CMS database if desired. Both databases need migrations.
Production setup runs `npm run db:deploy`, `npm run cms:migrate`, and
`npm run cms:seed` **before** starting the app. Seeding only creates missing
content and can be repeated safely. Public pages use published content; if CMS
configuration is absent or unavailable they show the built-in copy and log
load failures. Public reads have a two-second deadline and exclude unpublished
content. The CMS itself requires a working database and secret.

Published public fields are cached for five minutes. CMS edits invalidate this
cache immediately, including unpublishing. Private drafts, auth data, and load
failures are not cached here. CLI seeds or direct database edits outside Next.js
are picked up after the cache expires. Cold public CMS reads retain the
two-second deadline.

The Pikol rename migration updates the previous brand name in saved CMS copy,
including drafts and versions, while preserving other edits and links. Run
`npm run cms:migrate` when updating an existing installation. Existing accounts,
development email addresses, and database names remain valid.

After changing CMS fields, run `npm run cms:types`, `npm run cms:importmap`, and
`npm run cms:migrate:create -- --name describe-the-change`. Review and commit
the generated migration, then apply it with `npm run cms:migrate`.

## The core journey

1. Search a city → open a venue → pick a court, time, and duration.
2. **Reserve** → the court is `HELD` with a server-authoritative countdown.
3. Enter details → **pay the venue** (GCash/Maya) and upload a screenshot.
4. Booking becomes `PENDING_CONFIRMATION`.
5. Sign in as the owner → **Reservations** → review the proof → **Confirm**.
6. The booking is `CONFIRMED`; the player sees it on their status page.

## PayMongo readiness

GCash, Maya and QR Ph hosted checkout is prepared and **disabled by default**.
It uses explicit venue-to-merchant mappings, server-priced totals, signed
webhooks, private payment records and server reconciliation. Success redirects
do not mark payments paid; venue confirmation remains a separate step. Existing
direct transfers and screenshots continue to work while PayMongo is disabled.

After merchant verification, follow [the PayMongo activation guide](docs/deployment/paymongo.md)
for database migration, keys, webhook registration, scheduled reconciliation,
sandbox acceptance and live activation. `npm run payments:check` audits a disabled
rollout; `npm run payments:check -- --activation` checks configured readiness.
No charges or external webhooks are created by the check command. Refunds must
currently be handled in PayMongo; cancelling a reservation does not refund money.

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
retries, hold expiry, occupancy, availability, Supabase email/phone auth, private storage, and
authorization (owner cannot confirm another venue's booking; cross-user booking
reads denied).
CMS tests also cover private drafts, published content, anonymous access,
admin-role revocation, repeat seeding, and safe login return paths. Auth tests
verify provider-backed sessions, account binding, identity conflicts, refresh,
logout, and RLS denial using controlled provider responses and local PostgreSQL. The suite
applies both Prisma and CMS migrations to `TEST_DATABASE_URL`.
UI tests also cover date selection with ISO form values, accented city search,
and national city options when no venues are published.

## Scripts

| Script                  | What it does                              |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Dev server                                |
| `npm run build`         | Production build and standalone assets    |
| `npm run typecheck`     | `tsc --noEmit`                            |
| `npm run lint`          | ESLint                                    |
| `npm test`              | Vitest suite                              |
| `npm run db:deploy`     | Apply committed migrations (**use this**) |
| `npm run db:seed`       | Seed demo data                            |
| `npm run db:studio`     | Prisma Studio                             |
| `npm run cms:migrate`   | Apply committed CMS migrations            |
| `npm run cms:seed`      | Create missing marketing content          |
| `npm run cms:types`     | Generate Payload TypeScript types         |
| `npm run cms:importmap` | Generate editor component imports         |

> Apply migrations with **`db:deploy`**, not `prisma migrate dev` — the
> `bookings.period` generated column + EXCLUDE constraint make `migrate dev`
> report benign drift. See [`prisma/migrations/README.md`](prisma/migrations/README.md).

## Deferred (extensible, not built in this slice)

Owner onboarding wizard, admin verification UI, favorites, review writing,
notification delivery, owner calendar, walk-ins & court blocking UI, staff
management, interactive map, and the **Sentry connector** — the `BookingBackend`
seam, `SentryConnection` model, `PaymentProofStorage`, and `EmailSender`
interfaces are all in place for these.
