# RallyPoint Phase 7 — Production Hardening & Launch Preparation (Design)

Date: 2026-09-08
Branch: `build/phase7-hardening` (off `build/owner-onboarding`)
Status: design — approved for planning

## Goal

Make the existing standalone RallyPoint application **safe and deployable for a
real controlled pilot** (~3–5 Davao venues). This phase adds **no new product
features**, does not continue Sentry development, and does not push. It closes
the launch-configuration gaps identified in the approved production audit.

## Fixed decisions (from brainstorming)

- **Deploy target:** single VPS with a persistent, backed-up disk; TLS
  terminated by a reverse proxy (Caddy/nginx). RallyPoint runs as the Next.js
  `standalone` server; PostgreSQL 16 via Docker on the same host.
- **Email provider:** Resend (HTTP API). `EmailSender` stays abstract.
- **Object storage:** **deferred.** Because the pilot runs on a single host
  with a durable, backed-up volume, `LocalFsStorage` is safe for the pilot. The
  swappable `PaymentProofStorage`/media seam is preserved and the S3-compatible
  adapter is documented as the public-launch (P1) migration — **not built now.**
  This decision overrides the original spec item #4 "before pilot" framing.
- **Production-like E2E email:** an **injected capture sender** (in-process test
  double) so the E2E completes login→book→confirm deterministically. Real Resend
  delivery is a documented **manual** smoke step run with live credentials.
- **Branch/commits:** new branch `build/phase7-hardening`; incremental **local**
  commits per sub-phase; **no push** until explicitly instructed.

## Scope classification

**P0 — pilot blockers (build first, in order):**
1. Production email (Resend) with fail-fast selection.
2. Production environment validation + removal of production fallbacks.
3. Session cookie `Secure` in production.
4. Persistent customer-facing payment-disclosure pages (Terms / Privacy /
   Payment Policy) linked from the booking/payment flow.

**P1 — before public launch (build after P0, clearly gated):**
5. Minimal structured logging / observability.
6. SEO infrastructure (`sitemap.ts`, `robots.ts`).
7. Upload hardening (magic-byte validation, early oversize rejection).
8. Availability query fan-out reduction (read path only).

**Deferred (documented, NOT built this phase):** S3 object-storage adapter,
rate limiting, hold-expiry scheduler, `isActive`/session revocation. These
remain on the public-launch backlog.

## Guardrails — DO NOT CHANGE

`LocalBookingBackend` booking semantics; the PostgreSQL `EXCLUDE` constraint;
the `btree_gist` requirement; the booking state machine; idempotency behavior;
the owner authorization model; the review eligibility model; notification
transaction behavior (fire-after-commit, non-fatal); the standalone LOCAL
architecture. Sentry stays **inert** — no further implementation, no venue
marked `CONNECTED`.

---

## Sub-phase designs

### P0-A · Production email (Resend)

**Units**
- `src/lib/email/sender.ts` — unchanged `EmailSender` interface.
- `src/lib/email/dev-sender.ts` — unchanged `DevConsoleSender` (dev only).
- `src/lib/email/resend-sender.ts` — **new** `ResendSender implements EmailSender`.
  Constructed with `{ apiKey, from }`; `sendMagicLink(to, url)` calls Resend's
  send API. Network failures throw (caller/route already maps errors); never
  logs the URL/token at info level.
- `src/lib/email/select.ts` — **new** pure `selectEmailSender(env, deps?)`:
  - production → `ResendSender` built from validated env; if email env is
    missing this path is unreachable because env validation already failed at
    boot. A direct unit test still asserts it throws when constructed without
    config.
  - non-production → `DevConsoleSender`.
  - `deps` allows injecting a fake sender for tests/E2E (capture sender).
- `src/lib/email/index.ts` — selects via `selectEmailSender(env)` and re-exports.

**Env:** `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `RallyPoint <no-reply@domain>`).
**Dep:** add `resend` (runtime).
**Dev endpoints:** `/api/dev/last-magic-link` + `MagicLinkBanner` remain
`NODE_ENV`-gated (already true; add a regression test).

**Tests**
- production env → `selectEmailSender` returns a `ResendSender` (no network:
  inject a fake Resend transport / stub the client).
- production email env missing → construction throws (message names the missing
  vars, no values).
- non-production → returns `DevConsoleSender`.
- dev-only endpoint returns 404 when `NODE_ENV=production`.

### P0-B · Production environment validation

**Units**
- `src/lib/env.ts` — **new**, dependency-free. `loadEnv(raw = process.env)`
  parses once, returns a **frozen typed object**, and on failure throws an
  aggregated `EnvValidationError` listing offending variable **names only**
  (never values). Exports a memoized `env` for app use.
  - Required always: `DATABASE_URL`, `NODE_ENV`.
  - Required in production: `JWT_SECRET` (min length; not the known dev value),
    `APP_URL` (absolute URL; not `localhost`/`127.0.0.1`; `https:` in prod),
    `RESEND_API_KEY`, `EMAIL_FROM`.
  - Optional with in-code default: `HOLD_MINUTES` (default 10).
  - Sentry: `SENTRY_MODE`, `SENTRY_BASE_URL`, `SENTRY_CRED_SECRET` — validated
    (and `SENTRY_CRED_SECRET` required) **only when a Sentry mode is enabled**;
    the hardcoded fallback is removed regardless so accidental use throws.
  - Rejects known dev values in production: `dev-secret-change-in-production`,
    `dev-sentry-secret-change-in-production`, `localhost` APP_URL.
- `src/instrumentation.ts` — **new**. Next.js `register()` calls `loadEnv()`
  (server runtime only) so the server refuses to boot on invalid prod config.
- Refactor consumers to read validated env and **remove `??` fallbacks**:
  - `src/lib/auth/session.ts` — `JWT_SECRET` (no fallback in prod).
  - `src/lib/auth/magic-link.ts` / `src/app/layout.tsx` — `APP_URL`.
  - `src/lib/sentry/credentials.ts` — `SENTRY_CRED_SECRET` (no fallback).
- `.env.example` — document every variable, grouped Required-for-prod vs
  Dev/test-only; include `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_MODE`,
  `SENTRY_BASE_URL`, `SENTRY_CRED_SECRET`.

**Compatibility:** in `test`/`development`, dev defaults remain permitted so the
existing Vitest suite and local dev keep working. Validation strictness applies
to `NODE_ENV=production`.

**Tests**
- production + missing `JWT_SECRET` → throws; message contains `JWT_SECRET`, no
  secret value.
- production + `JWT_SECRET` = known dev value → throws (weak-value rejection).
- production + missing `APP_URL` (or `localhost`) → throws.
- production + missing email env → throws.
- development with dev defaults → loads OK.
- error message never contains any provided secret value.

### P0-C · Session cookie `Secure`

**Units**
- `src/lib/auth/session.ts` — `sessionCookie()` / `clearSessionCookie()` set
  `secure: env.isProduction` (true in production, false in dev so local HTTP
  works). Preserve `httpOnly`, `sameSite: "lax"`, `path: "/"`, `maxAge`.

**HTTPS:** real TLS is provided by the reverse proxy; documented in the deploy
notes. The automated gate asserts the `Secure` attribute is present in
production rather than standing up TLS in the suite.

**Tests**
- production → cookie descriptor has `secure: true`, `httpOnly: true`,
  `sameSite: "lax"`.
- development → `secure: false` (regression: local login still works).
- logout cookie clears with matching attributes.

### P0-D · Payment-disclosure pages

**Units**
- `src/lib/legal/content.ts` — **new**. Editable policy content (Terms, Privacy,
  Payment Policy) as structured data, clearly marked *"template for business/
  legal review — not legal advice."* Wording configurable here without touching
  JSX. Must state:
  - payment goes **directly to the venue**;
  - RallyPoint **does not hold** customer money;
  - RallyPoint **does not independently verify** payment settlement;
  - refunds/disputes handled per the **venue's** policy.
- `src/app/(site)/terms/page.tsx`, `.../privacy/page.tsx`,
  `.../payment-policy/page.tsx` — **new** public server components rendering the
  content; each with `generateMetadata` (indexable, canonical).
- Links: add to `PaymentStep` (near the pay CTA), the booking-status page, and a
  site footer/nav.

**Tests**
- each route returns 200 and contains its required disclosure sentences.
- payment flow renders a link to the payment policy.

---

### P1-E · Structured logging / observability

**Units**
- `src/lib/log.ts` — **new**, dependency-free JSON-line logger with levels
  (`info`/`warn`/`error`), optional context object, and a redaction guard that
  drops known-sensitive keys (`token`, `password`, `secret`, `authorization`,
  `apiKey`, proof bytes). Optional `requestId` passed through context.
- `src/lib/http.ts` — `errorResponse` logs `AppError` with `httpStatus >= 500`
  and unhandled errors at `error` with safe context (code, status, route,
  requestId); 4xx AppErrors are not logged (or logged at `debug`).
- Auth: log failed magic-link request/verify at `warn` **without** tokens.
- Booking/payment/storage/integration failures logged with useful identifiers
  (booking reference, venueId, key) — never proof contents or secrets.
- Notification failures remain caught and **non-fatal** to booking txns
  (unchanged behavior; now logged via the structured logger).

**Tests**
- `errorResponse` on a 500-class AppError emits one `error` log with code/status
  and no secret fields.
- redaction: a context containing `token`/`secret` is scrubbed.

### P1-F · SEO infrastructure

**Units**
- `src/app/sitemap.ts` — **new**. Static public routes (`/`, `/search`,
  `/list-your-venue`, `/terms`, `/privacy`, `/payment-policy`) + one entry per
  **live** venue (`isPublished && status === "APPROVED"`).
- `src/app/robots.ts` — **new**. Allow public; `disallow`
  `/owner`, `/admin`, `/book`, `/bookings`, `/login`, `/api`; reference sitemap.
- Preserve existing unpublished-venue `notFound()` + `robots:{index:false}`.

**Tests**
- sitemap includes a published+approved venue and **excludes** a
  draft/pending/suspended one.
- robots disallows each private prefix and points at the sitemap.

### P1-G · Upload hardening

**Units**
- `src/lib/storage/local-fs-storage.ts` (+ shared validation helper) —
  add **magic-byte** signature validation for JPEG/PNG/WebP; reject when the
  sniffed type disagrees with the allowed set. Keep `MAX_PROOF_BYTES` + allowed
  MIME. In the upload routes
  (`api/bookings/[id]/payment`, `api/owner/venues/[id]/photos`), reject when the
  declared `file.size` exceeds the limit **before** buffering the whole body.
- Proof privacy and media authz unchanged.

**Tests**
- content-type spoof (png header on a non-image / wrong magic bytes) → rejected.
- oversize (declared size over limit) → rejected before buffering.
- valid jpeg/png/webp → accepted; existing storage-authorization tests stay
  green.

### P1-H · Availability query fan-out reduction

**Units**
- `src/lib/availability/engine.ts` — remove the redundant per-court
  `court.findUnique` (reuse the already-loaded court), and batch
  `scheduleException.findMany` / occupancy lookups per venue instead of per
  court. Keep the existing short-TTL (45s) search cache. **Do not** cache
  booking creation. **Do not** alter the EXCLUDE constraint or the create path.

**Tests**
- availability results are unchanged vs. current behavior (existing
  `tests/availability/engine.test.ts` stays green; add a query-count/shape
  assertion if practical).
- booking concurrency test (`tests/booking/concurrency.test.ts`) unchanged and
  green.

---

## Testing strategy & gates

**After each sub-phase:** `npm run typecheck` → `npm run lint` →
`npm test` (full Vitest against `rallypoint_test`) → relevant targeted tests.

**Final gate:**
- typecheck = 0
- lint = 0
- full Vitest = green
- production build = green (`npm run build`)
- **production-like HTTP E2E = green**

**Production-like HTTP E2E (new):** a Vitest (or Node) harness that builds and
starts the `standalone` server with `NODE_ENV=production` and a full set of
valid env values, then drives real HTTP with `fetch`. The `EmailSender` is
replaced by an **injected capture sender** so the magic link is retrievable
in-process. Covers the smoke flow: request link → login → find venue → book →
submit proof → owner confirm → in-app confirmation → complete → review; plus
proof access control, unpublished-media privacy, double-booking rejection, and
**server refuses to start with unsafe secrets**.

**Explicit test additions required:** production env validation; missing/weak
`JWT_SECRET`; missing `APP_URL`; production email selection; production session
cookie `Secure`; storage authorization (existing, kept green); upload
validation; terms/privacy route availability; SEO route generation; existing
booking concurrency (kept green).

## Production smoke test (manual, with live creds)

Run a production-like build and verify the 14-point checklist from the Phase 7
brief, including **real Resend delivery** (step 2) and **the server failing to
start with unsafe secrets** (step 14). The automated E2E covers all points
except real email delivery, which is verified manually.

## New/changed dependencies

- **Add:** `resend` (runtime).
- No other new runtime deps (env validator, logger, magic-byte sniff,
  sitemap/robots are hand-rolled or Next built-ins).

## Environment variables (names only)

**Required for production:** `DATABASE_URL`, `JWT_SECRET`, `APP_URL`,
`NODE_ENV`, `RESEND_API_KEY`, `EMAIL_FROM`. Optional: `HOLD_MINUTES`.
**Only if Sentry is enabled (not for pilot):** `SENTRY_MODE`, `SENTRY_BASE_URL`,
`SENTRY_CRED_SECRET`.
**Dev/test only:** `TEST_DATABASE_URL`, `SENTRY_MODE=mock`.

## Out of scope / explicitly deferred

S3 object-storage adapter; rate limiting; hold-expiry scheduler; `isActive`
enforcement & session revocation; image optimization via `next/image`; push/SMS;
map; tournaments; analytics; any Sentry implementation work.
