# RallyPoint — Sentry Connector Contract & Status

**Date:** 2026-09-07
**Companion to:** `2026-09-07-rallypoint-phase6-sentry-connector-design.md`

This document records the **RallyPoint-normalized** contract the Sentry connector
is built against, the state/error mappings, and — most importantly — an explicit
statement of what is and is not verified.

## 1. The normalized port (RallyPoint-owned)

`src/lib/sentry/port.ts` defines `SentryClient` in RallyPoint's own terms. It is
**not** a description of Sentry's real wire API (which is unavailable in this
workspace). Any real integration must translate the actual Sentry API into these
types.

```
authCheck(): Promise<void>
listResources(): Promise<SentryResource[]>            // { externalRef, name, capacity? }
getAvailability({ resourceRef, from, to }): Promise<SentryBusyRange[]>  // { startsAt, endsAt }
createBooking(SentryCreateBookingInput): Promise<SentryBooking>        // { externalRef, state, startsAt, endsAt }
getBooking(externalRef): Promise<SentryBooking>
cancelBooking(externalRef): Promise<SentryBooking>
```

`ExternalBookingState` (normalized): `held | confirmed | cancelled | completed | rejected`.

## 2. State mapping (normalized → RallyPoint)

`src/lib/sentry/mapping.ts#externalStateToStatus`:

| ExternalBookingState | RallyPoint BookingStatus |
|---|---|
| `held` | `HELD` |
| `confirmed` | `CONFIRMED` |
| `cancelled` | `CANCELLED` |
| `completed` | `COMPLETED` |
| `rejected` | `REJECTED` |

`held → HELD` deliberately. `PENDING_CONFIRMATION` is RallyPoint's
payment-submitted / venue-confirmation semantic, which the Sentry connector does
**not** drive; mapping to it would invent a semantic the connector does not
support. A Sentry `HELD` index row is stored with `holdExpiresAt = null`, so the
local `expireStale` sweep (`holdExpiresAt < now`, NULL excluded) never touches it.

## 3. Error taxonomy (normalized → HTTP)

`src/lib/sentry/errors.ts`. No message ever includes credentials, base URL, or
raw upstream payloads.

| Condition | Error | HTTP |
|---|---|---|
| Authentication failure | `SentryAuthError` | 502 |
| Service unavailable | `SentryUnavailableError` | 503 |
| Rate limited | `SentryRateLimitError` | 503 |
| Invalid / unknown resource | `SentryInvalidResourceError` | 404 |
| Timeout | `SentryTimeoutError` | 504 |
| Unexpected/unparseable response | `SentryUnexpectedResponseError` | 502 |
| HTTP layer not implemented | `SentryContractUnavailableError` | 501 |
| Out-of-phase backend method | `SentryUnsupportedOperationError` | 409 |
| Slot already taken | `SlotTakenError` (shared) | 409 |

## 4. What each backend method does for SENTRY venues

Implemented: `getOccupied`, `createHold`, `cancel`, `getStatus`.
Unsupported this phase (throw `SentryUnsupportedOperationError`): `createWalkIn`,
`reschedule`, `submitDetails`, `submitPayment`, `confirm`, `reject`, `complete`.
`expireStale` returns `0`. Source of truth: Sentry; the RallyPoint `Booking`
(`backendType = SENTRY`, `externalRef`, last-known `status`) is an index only.

## 5. Verification status (READ THIS)

1. **Sentry adapter architecture — implemented.** Port, normalized types,
   `MockSentryClient` reference, `SentryBookingBackend`, resolver, factory,
   credential cipher, error taxonomy, and mappings are complete.
2. **Mock/contract tests — passing.** `tests/sentry/*` plus Local↔Sentry
   contract-parity tests are green, and an HTTP e2e drives the player
   search→book→status flow against a Sentry-backed venue with `SENTRY_MODE=mock`.
3. **Real Sentry HTTP contract — NOT live-verified.** No live Sentry API or
   documented wire contract is available in this workspace. `HttpSentryClient`
   throws `SentryContractUnavailableError` for every method and carries
   `TODO(real-contract)` notes. Nothing depends on a fabricated contract.
4. **Production Sentry compatibility — NOT claimed.** It must not be claimed until
   `HttpSentryClient` is implemented against the real Sentry API and exercised
   with live credentials + live tests.

## 6. Next Sentry slice (deferred)

Implement `HttpSentryClient` against the real contract (auth, endpoints, timeout,
real-state → `ExternalBookingState` translation, HTTP-failure → error taxonomy),
add live integration tests, then Sentry webhooks for push-based availability.
