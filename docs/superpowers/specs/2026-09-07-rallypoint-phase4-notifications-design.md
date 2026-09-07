# RallyPoint Phase 4 — Notifications (Design + Decisions)

**Date:** 2026-09-07 · **Branch:** `build/owner-onboarding` (continues) · **Status:** Approved, proceeding.

Adds an in-app notification system around the existing booking lifecycle. The
booking engine, EXCLUDE constraint, state machine, and all Phase 1–3 tests are
the baseline and must not be destabilized.

## Decision 1 — Where notifications fire

From the **backend intent methods, after the DB transaction commits**, via a
`notificationService`, **awaited but best-effort** (errors are logged and
swallowed so a delivery failure never rolls back or breaks a booking action).
This keeps notification logic server-side (never in UI components) and central,
so every route that triggers an intent gets notifications for free.

## Decision 2 — Delivery abstraction (in-app now; email/push later)

`notificationService.create()` writes the in-app `Notification` row (the store
the notification center reads), then dispatches to a `NotificationDelivery`
channel. The only channel now is `DevLogDelivery` (console). A real email
channel (reusing/extending the `EmailSender` seam) or push can be added by
swapping the channel — no caller changes, no real provider required this phase.

## Decision 3 — Schema (one field)

`Notification.link String?` — the role-appropriate click target
(`/bookings/[ref]` for players, `/owner/reservations/[ref]` for owners).
`bookingId` remains the related-entity reference. No generic Json metadata
(YAGNI). Applied via a hand-authored additive migration + `db:deploy`.

## Event → notification map

Recipients are resolved server-side. Owner recipients = `venue.ownerId` + venue
staff user ids.

| Intent | Player | Owner |
|---|---|---|
| createHold (online) | BOOKING_CREATED | — |
| submitPayment | PAYMENT_SUBMITTED | NEW_RESERVATION |
| confirm | BOOKING_CONFIRMED | — |
| reject | BOOKING_REJECTED | — |
| cancel (by customer) | — | CUSTOMER_CANCELLED |
| cancel (by venue/admin) | BOOKING_CANCELLED | — |
| expireStale | BOOKING_EXPIRED | — |
| sweepUpcomingReminders | BOOKING_REMINDER | BOOKING_REMINDER |

Walk-ins (owner-created, no user account) create no in-app recipient row.
`reschedule`/`complete` are not in the required set — no notification.

## Dedupe

`createOnce(userId, type, bookingId)` skips if a matching notification already
exists — used for reminders (so repeated sweeps don't spam) and BOOKING_CREATED
(idempotent-hold retries). Lifecycle events (confirm/reject/cancel/expire) fire
once because the state machine rejects repeat transitions.

## Reminders

`sweepUpcomingReminders(now, withinMinutes=120)` finds CONFIRMED bookings
starting within the window and creates deduped reminders for player + owners.
The generation logic + a dev/manual trigger are in scope and tested; wiring it
to a real cron/scheduler is deferred ("advanced notification scheduling").

## Read state + authorization

- `listForUser(userId)`, `unreadCount(userId)`, `markRead(userId, id)` (scoped:
  `updateMany where {id, userId}` so a user can't touch another's), `markAllRead(userId)`.
- API routes `GET /api/notifications`, `GET /api/notifications/unread-count`,
  `POST /api/notifications/[id]/read`, `POST /api/notifications/read-all` — all
  `requireUser`, every query filtered by `session.id`. No cross-user access;
  owner notifications only concern venues they own/manage (guaranteed by
  recipient resolution at creation).

## Notification center UI

A bell + unread badge in the site (player) and owner headers, shown when
authenticated. Opens a `Dialog` (bottom-sheet on mobile) listing recent
notifications; clicking one marks it read and navigates to `link`; a "Mark all
read" action. Mobile-first; no large dashboard.

## Testing

Service: create, correct recipient, unauthorized access (markRead scoped),
read/unread transitions, mark-all-read, dedupe (double sweep → one reminder).
Booking integration: confirmation, rejection, payment-submission (player +
owner), cancellation (customer vs venue direction), expiration. Regression: all
Phase 1–3 tests.

## Deferred (unchanged)

Real email provider, push, SMS, notification-preferences UI, advanced
scheduling/cron, reviews, Sentry connector, map.
