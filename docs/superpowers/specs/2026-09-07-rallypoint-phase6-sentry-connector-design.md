# RallyPoint — Phase 6: Sentry Connector — Design Spec

**Date:** 2026-09-07
**Status:** Approved (with amendments, folded in below)
**Branch:** `build/owner-onboarding` (continues the Phase 2–5 stack; commit locally, **do not push**)
**Scope:** Implement a Sentry booking integration behind the existing `BookingBackend` seam, without changing the player-facing booking experience. No live Sentry API exists in this workspace.

---

## 0. Objective & honesty constraint

Add a `SentryBookingBackend` that satisfies the existing `BookingBackend` interface so a
Sentry-connected venue can be searched and booked through the same routes and UI as a local
venue. **The proven `LocalBookingBackend` is not rewritten or weakened.**

There is **no live Sentry API** here. Therefore (amendment #2) we do **not** invent undocumented
Sentry HTTP endpoints, request/response shapes, or state semantics — not even labelled "ASSUMED".
We build the full seam (port, normalized types, mock client, adapter, error taxonomy, mappings,
contract tests) against a **RallyPoint-normalized port contract**, and leave the real HTTP layer
explicitly unverified/TODO.

## 1. What the codebase already provides

- `BookingBackend` interface (`src/lib/booking/backend.ts`) with `createHold`, `createWalkIn`, `reschedule`, `submitDetails`, `submitPayment`, `confirm`, `reject`, `cancel`, `complete`, `expireStale`, `getOccupied`.
- `bookingBackend` **singleton** = `new LocalBookingBackend()` (`src/lib/booking/index.ts`), imported directly by the availability engine (`getOccupied`) and the bookings `POST` route (`createHold`), plus owner-ops routes.
- Availability engine composes `court schedule − schedule exceptions − getOccupied()` (`src/lib/availability/engine.ts`); `courtSlotsForDate` is uncached; the search page caches results via `cached()` (`src/lib/availability/cache.ts`).
- `SentryConnection` model: `venueId @unique`, `sentryBusinessRef`, `encryptedApiKey`, `entitlement`, `connectionState` (default `DISCONNECTED`), timestamps.
- `AppError` hierarchy + `errorResponse` map thrown domain errors to safe HTTP responses.
- Env convention: `JWT_SECRET` with a dev fallback string. Tests: Vitest + `tests/db.ts#resetDb` (already truncates `sentry_connections`) + `tests/factories.ts`.

## 2. Final decisions (govern this phase)

| # | Decision |
|---|---|
| 1 | Add `getStatus(bookingId): Promise<{ status: BookingStatus; externalRef: string \| null }>` to `BookingBackend`. `LocalBookingBackend` implements it trivially (reads its own row). `SentryBookingBackend` refreshes from Sentry and updates **only the last-known local index state** (`status`, `updatedAt`), never other fields. |
| 2 | **No invented Sentry wire contract.** The `SentryClient` port is defined in RallyPoint-normalized terms. `MockSentryClient` is the fully-tested reference implementation. `HttpSentryClient` methods throw a normalized `SentryContractUnavailableError` with a `TODO(real-contract)` note describing what the real endpoint must provide — **no fabricated URLs/JSON/state strings**. |
| 3 | Sentry adapter implements **only** `getOccupied`, `createHold`, `cancel`, `getStatus`. All of `submitPayment`, `confirm`, `reject`, `complete`, `reschedule`, `createWalkIn`, `submitDetails` throw `SentryUnsupportedOperationError`; `expireStale` is a no-op returning `0`. |
| 4 | Add a booking backend discriminator: `enum BackendType { LOCAL SENTRY }` and `Booking.backendType BackendType @default(LOCAL)`. A Sentry index row can never be treated as a locally-authoritative booking. |
| 5 | Backend selection: `resolveBackend(venueId)` returns the Sentry adapter when the venue's `SentryConnection.connectionState === "CONNECTED"`, else the local singleton. |
| 6 | Mapping storage: nullable columns — `Court.externalRef` (Sentry resource id) and `Booking.externalRef` (Sentry booking id). Last-known status reuses `Booking.status`. |
| 7 | Preserve architecture: Local unchanged; Postgres authoritative for LOCAL; Sentry authoritative for SENTRY. Search availability may use short-TTL cache; **createHold and getStatus must not rely on stale availability cache**. |
| 8 | All Phase 1–5 tests remain untouched and green. |
| 9 | End-of-phase honesty statement (see §11). No production-readiness claim. |

## 3. Architecture (ports & adapters)

```
API routes / availability engine
   └─ resolveBackend(venueId) ──► BookingBackend
         ├─ LocalBookingBackend    (UNCHANGED — Postgres authoritative)
         └─ SentryBookingBackend   (NEW — depends only on the SentryClient port)
               └─ SentryClient (port, RallyPoint-normalized)
                     ├─ HttpSentryClient  (skeleton; throws SentryContractUnavailableError; TODO real contract)
                     └─ MockSentryClient  (in-memory reference; drives all tests + SENTRY_MODE=mock e2e)
```

All unverifiable concerns are isolated to `HttpSentryClient`. The adapter, routes, and UI depend
only on the port, so real credentials + a real contract slot into `HttpSentryClient` later with no
change elsewhere.

## 4. New module: `src/lib/sentry/`

### 4.1 `port.ts` — the normalized port + types
`SentryClient` interface, expressed in RallyPoint-normalized terms (NOT Sentry JSON):

```ts
export type ExternalBookingState = "held" | "confirmed" | "cancelled" | "completed" | "rejected";

export interface SentryResource { externalRef: string; name: string; capacity?: number | null }
export interface SentryBusyRange { startsAt: Date; endsAt: Date }
export interface SentryBooking { externalRef: string; state: ExternalBookingState; startsAt: Date; endsAt: Date }
export interface SentryCreateBookingInput {
  resourceRef: string; startsAt: Date; endsAt: Date;
  customer: { name?: string | null; email?: string | null; mobile?: string | null };
  idempotencyKey?: string | null;
}

export interface SentryClient {
  authCheck(): Promise<void>;
  listResources(): Promise<SentryResource[]>;
  getAvailability(input: { resourceRef: string; from: Date; to: Date }): Promise<SentryBusyRange[]>;
  createBooking(input: SentryCreateBookingInput): Promise<SentryBooking>;
  getBooking(externalRef: string): Promise<SentryBooking>;
  cancelBooking(externalRef: string): Promise<SentryBooking>;
}
```

`ExternalBookingState` is RallyPoint's normalized port vocabulary. A real `HttpSentryClient` would be
responsible for translating the actual (currently-unavailable) Sentry states into these — that
translation is the documented TODO.

### 4.2 `errors.ts` — normalized taxonomy (→ `AppError`)
`SentryAuthError`, `SentryUnavailableError`, `SentryRateLimitError`, `SentryInvalidResourceError`,
`SentryTimeoutError`, `SentryUnexpectedResponseError`, `SentryContractUnavailableError` (HTTP layer
not implemented), `SentryUnsupportedOperationError` (out-of-phase backend method). Slot conflicts map
to the existing `SlotTakenError` (409). No error ever includes credentials, base URL, or secrets.

### 4.3 `credentials.ts` — `CredentialCipher`
AES-256-GCM (`node:crypto`), key derived from `SENTRY_CRED_SECRET` env (dev fallback, mirroring
`JWT_SECRET`). `encrypt(plaintext): string` (iv:tag:ciphertext, base64) / `decrypt(payload): string`.
Used to write/read `SentryConnection.encryptedApiKey`. Server-only; never serialized to the browser.

### 4.4 `mapping.ts` — pure, documented mappers
- `resourceToCourtPresentation(resource, court)` — pairs a Sentry resource with the RallyPoint court that carries marketplace content (name/photos/price). RallyPoint metadata wins for presentation; Sentry supplies live state.
- `busyRangesToOccupied(ranges): OccupiedRange[]` — Sentry busy → RallyPoint occupancy (status label `CONFIRMED` for occupancy purposes).
- `externalStateToStatus(state): BookingStatus` — **documented table** over the normalized `ExternalBookingState` only:

  | ExternalBookingState | BookingStatus |
  |---|---|
  | `held` | `HELD` |
  | `confirmed` | `CONFIRMED` |
  | `cancelled` | `CANCELLED` |
  | `completed` | `COMPLETED` |
  | `rejected` | `REJECTED` |

  Note: `held → HELD` (never `PENDING_CONFIRMATION`, which is RallyPoint's
  payment-submitted/venue-confirmation semantic that the Sentry connector does
  not drive). A Sentry `HELD` index row is stored with `holdExpiresAt = null`, so
  the local `expireStale` sweep (`holdExpiresAt < now`) never touches it.

- `holdInputToCreateBooking(input, resourceRef)` — RallyPoint `HoldInput` → `SentryCreateBookingInput`.

### 4.5 `mock-client.ts` — `MockSentryClient`
In-memory resources + bookings implementing `SentryClient` fully. Constructor knobs simulate:
`failAuth`, `timeout`, `rateLimit`, `unknownResource`, `conflict`, `badResponse`. This is the "mock
Sentry server/test adapter" and the reference the contract tests run against.

### 4.6 `http-client.ts` — `HttpSentryClient` (explicitly unverified)
Implements `SentryClient`. Holds `{ baseUrl, apiKey }` (real credential handling) but every method
throws `SentryContractUnavailableError` with a `// TODO(real-contract): <what the real endpoint must
provide>` note. No invented endpoints/JSON. This is where a future slice wires the real Sentry API.

### 4.7 `factory.ts` — `sentryClientForVenue(venueId)`
Loads the `SentryConnection`, decrypts the credential, and returns a `SentryClient`:
`MockSentryClient` when `SENTRY_MODE=mock` (dev + HTTP e2e), else `HttpSentryClient`. Tests inject
`MockSentryClient` into `SentryBookingBackend` directly.

## 5. `SentryBookingBackend` + resolver

`src/lib/booking/sentry-backend.ts` — `SentryBookingBackend implements BookingBackend`, constructed
with `(client: SentryClient, deps)`. Implements:
- `getOccupied(courtId, from, to)` → load `court.externalRef`; if unset throw `SentryInvalidResourceError`; `client.getAvailability` → `busyRangesToOccupied`.
- `createHold(input)` → resolve the court's `externalRef`; `client.createBooking`; create a RallyPoint `Booking` index row with `backendType: SENTRY`, `externalRef`, `status = externalStateToStatus(...)`, `holdExpiresAt: null`, `source: ONLINE`; write a `BookingStatusHistory` entry; return `HeldBooking`. Idempotency: pass `idempotencyKey` to the client and reuse the existing `Booking.idempotencyKey` unique to short-circuit replays.
- `cancel(bookingId, actor)` → load the SENTRY index row; `client.cancelBooking(externalRef)`; update local `status` + history.
- `getStatus(bookingId)` → load the SENTRY index row; `client.getBooking(externalRef)`; map + update **only** `status`/`updatedAt`; return `{ status, externalRef }`.
- Every other method throws `SentryUnsupportedOperationError`; `expireStale()` returns `0`.

`src/lib/booking/resolve.ts` — `resolveBackend(venueId): Promise<BookingBackend>`: loads the venue's
`SentryConnection`; `connectionState === "CONNECTED"` → `new SentryBookingBackend(sentryClientForVenue(venueId), …)`;
else the existing local `bookingBackend` singleton. `LocalBookingBackend.getStatus` is added (reads its
own row) so both backends satisfy the extended interface. The local singleton export stays for
global local-only ops (`expireStale` cron, reminder sweep).

## 6. Data model (additive migration via `db:deploy` + `db:generate`)

```prisma
enum BackendType { LOCAL SENTRY }

// Booking: + backendType BackendType @default(LOCAL)
//          + externalRef String?
//          @@index([backendType])
// Court:   + externalRef String?
```

Migration SQL: create the enum, `ALTER TABLE "bookings" ADD COLUMN "backendType" "BackendType" NOT
NULL DEFAULT 'LOCAL'` (backfills existing rows), `ADD COLUMN "externalRef" TEXT`, index on
`backendType`; `ALTER TABLE "courts" ADD COLUMN "externalRef" TEXT`. No `SentryConnection` change.
The RallyPoint row for a SENTRY booking is an **index, not the authority** — `getStatus` refreshes
from Sentry and stale local state never overrides it.

## 7. Wiring (minimal blast radius; LOCAL behavior identical)

Resolver is wired into exactly the four in-scope paths:
- Availability engine `courtSlotsForDate` → `resolveBackend(court.venueId).getOccupied(...)`.
- Bookings `POST` (`createHold`) → `resolveBackend(court.venueId)`.
- Customer cancel route → `resolveBackend(booking.venueId)`.
- A status-refresh path → `resolveBackend(booking.venueId).getStatus(...)`.

Owner payment/confirm/reject/complete/reschedule/walk-in stay local-only this phase (documented);
they operate on LOCAL bookings and are never invoked for SENTRY venues.

## 8. Source of truth & caching

- LOCAL: Postgres authoritative (unchanged). SENTRY: Sentry authoritative; RallyPoint stores only an index (venue, customer, `externalRef`, last-known `status`, timestamps, `backendType=SENTRY`).
- Search availability may reuse `cached()` (short TTL) at the search layer only.
- `createHold` validates via `courtSlotsForDate` → live `getOccupied` (uncached), and `getStatus` calls Sentry live — neither relies on the availability cache.

## 9. Error handling

Every integration failure normalizes through `errors.ts` to an `AppError` so `errorResponse` returns
a safe status/message. Conditions covered: authentication failure, service unavailable, rate limit,
invalid resource, slot unavailable (→ `SlotTakenError`), timeout, unexpected response, contract
unavailable, unsupported operation. Credentials/secrets never appear in responses or logs.

## 10. Testing

- **Contract-parity harness** (`tests/sentry/contract.test.ts`): the same behavioral assertions run against `LocalBookingBackend` and `SentryBookingBackend(MockSentryClient)` where applicable — occupancy semantics, `createHold` → `HeldBooking`, idempotent replay returns the same booking, unavailable slot → `SlotTakenError`, `cancel`, `getStatus`; unsupported methods throw `SentryUnsupportedOperationError`.
- **Adapter tests** (`tests/sentry/adapter.test.ts`): resource lookup, availability mapping, booking creation, duplicate/idempotent, unavailable slot, status lookup + mapping, and each error mapping (auth failure, timeout, rate limit, invalid resource, unexpected response) via mock knobs; unauthorized/`getOccupied` with unmapped court.
- **Mapping tests** (`tests/sentry/mapping.test.ts`): `externalStateToStatus` table, `busyRangesToOccupied`, `holdInputToCreateBooking`.
- **Credential tests** (`tests/sentry/credentials.test.ts`): encrypt/decrypt round-trip; tampered payload rejected; errors never contain plaintext.
- **HTTP client tests**: every method throws `SentryContractUnavailableError` (guards against accidental fabrication).
- **Resolver test**: LOCAL for non-connected venue; SENTRY for `CONNECTED`.
- **Regression:** all Phase 1–5 tests remain green and untouched (double-booking race, EXCLUDE, holds, payment, confirm, cancel, reviews, notifications). No existing test is replaced with a Sentry mock.

## 11. Verification gate & honesty statement

Gate: `typecheck = 0`, `lint = 0`, full Vitest green, production build green, plus an **HTTP
integration e2e** driving the same player `search → createHold` flow through the real routes against
a Sentry-backed venue with `SENTRY_MODE=mock`, proving the UI/API contract is unchanged.

End-of-phase statement (spec, `docs/.../2026-09-07-rallypoint-phase6-sentry-contract.md`, and the
final report):
1. Sentry adapter architecture implemented.
2. Mock/contract tests passing.
3. Real Sentry HTTP contract **NOT** live-verified (no API/credentials in this workspace).
4. Production Sentry integration **NOT** claimed.

## 12. Explicitly deferred

Sentry webhooks (the next Sentry slice), advanced synchronization, automated venue onboarding to
Sentry, Sentry admin provisioning, time-of-day pricing, multi-system reconciliation tooling,
interactive map, new customer features.

## 13. Sub-phase order

- **6A** — `port.ts` + `errors.ts` + `credentials.ts` + `mapping.ts` (+ unit tests).
- **6B** — `MockSentryClient` + `HttpSentryClient` (+ tests, incl. contract-unavailable + error simulation).
- **6C** — schema (`BackendType`, `Booking.backendType/externalRef`, `Court.externalRef`) + `SentryBookingBackend` + `getStatus` on Local + `resolveBackend` + `factory` (+ adapter tests).
- **6D** — wire resolver into availability engine + bookings `POST` + cancel + status path; `SENTRY_MODE=mock` factory wiring.
- **6E** — contract-parity tests + regression + HTTP integration e2e + contract doc + honesty statement.

After each sub-phase: run tests, typecheck, lint; fix failures before proceeding.
