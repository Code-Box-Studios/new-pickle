# PayMongo activation guide

Pikol's hosted checkout integration is **disabled by default**. Existing direct
venue transfers and payment screenshots continue to work. The integration uses
[Checkout v2](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
for GCash (`gcash`), Maya (`paymaya`) and QR Ph (`qrph`), with PHP totals calculated
by the booking server. No customer fee is added. Confirm channel eligibility and
fees in your approved merchant account; this code does not activate them.

## 1. Choose the correct merchant

Money is collected by the **PayMongo merchant whose secret key creates checkout**.
Only explicitly mapped, approved venues belonging to that merchant's configured
Pikol owner can use it. `ownerId` is the `public.users.id`, **not** the Supabase
Auth UUID. `venueIds` are `public.venues.id`, not slugs.

For unrelated venue businesses, each must have its own approved merchant and
credentials, or use a separately approved PayMongo marketplace/Connect arrangement.
Do not put every venue on Pikol's single merchant account. Split settlements,
commissions and payouts are not implemented here. Checkout receipts mean the
merchant received a payment, not that the venue's bank payout has completed.

## 2. Apply the additive database migration

Deploy the prepared application with both payment flags `false` first. Vercel's
build does **not** apply database migrations. From a trusted terminal configured
for the intended database:

```bash
npm run db:deploy
npm run db:generate
```

Migration `20261004130000_paymongo_readiness` creates the private checkout and
normalized webhook receipt tables, enables RLS, adds QR Ph, and makes proof
screenshots optional for verified provider receipts. It preserves bookings and
the generated booking-period exclusion constraint. Never run `migrate reset`
or `migrate dev` against production.

If `pikol_server` exists, the migration grants its trusted runtime access and
policies. If your runtime role is different, grant only the trusted server role
CRUD with an appropriate RLS policy. Never grant `anon` or `authenticated` access.
Use separate migration administrator credentials. Run readiness checks with the
**same DATABASE_URL credentials as Vercel**, not just the database administrator.

## 3. Configure sandbox settings

Set private server environment values in Vercel, redeploy, and keep creation off
while registering the webhook. Do not paste private keys into chat or commit them.

```dotenv
PAYMONGO_ENABLED=false
PAYMONGO_LEDGER_READY=true
PAYMONGO_MODE=test
PAYMONGO_MERCHANTS=[{"alias":"my-venue","ownerId":"PIKOL_OWNER_ID","venueIds":["PIKOL_VENUE_ID"],"methods":["gcash","paymaya","qrph"]}]
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=SIGNING_SECRET_FROM_PAYMONGO
APP_URL=https://pikol-ph.vercel.app
CRON_SECRET=PRIVATE_RANDOM_VALUE_AT_LEAST_32_CHARACTERS
```

For multiple merchants, use unique aliases and non-overlapping venue lists;
each entry accepts `secretKeyEnv` and `webhookSecretEnv`, e.g.
`PAYMONGO_LANANG_SECRET_KEY` and `PAYMONGO_LANANG_WEBHOOK_SECRET`.
Each merchant gets its own signing secret and URL. Never use `NEXT_PUBLIC_` for
merchant keys or webhook secrets. Browser code receives neither API credentials
nor raw billing data.

### Webhook

Register **once per merchant and mode** in PayMongo's dashboard:

```text
https://pikol-ph.vercel.app/api/webhooks/paymongo/my-venue/test
Event: checkout_session.payment.paid
```

Copy that webhook's signing secret into the matching environment value.
Follow PayMongo's [webhook setup and signature guide](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).
Pikol verifies the `Paymongo-Signature` header over the raw bytes, with the
correct test/live HMAC and a five-minute timestamp tolerance. Unrelated events
are acknowledged; malformed paid events are rejected for investigation.

The server records the receipt before acknowledging. Duplicate event/payment
delivery cannot repeat booking transitions. Notifications run after settlement.

### Scheduled reconciliation

Schedule this URL **every minute** using a scheduler that supports a private
Authorization header (or a suitable paid Vercel Cron plan):

```text
GET https://pikol-ph.vercel.app/api/payments/paymongo/reconcile
Authorization: Bearer <CRON_SECRET>
```

Do not put the secret in the URL. There is no scheduler installed automatically.
Each call handles up to nine sessions with three concurrent provider requests;
monitor backlog and increase scheduling capacity when usage grows. Free hosting
cron frequency may be insufficient, so verify the scheduler's actual cadence.

PayMongo session expiration is independent of Pikol's hold countdown. This job
retrieves and attempts to expire abandoned checkout sessions through the
[official expiration endpoint](https://docs.paymongo.com/reference/create_checkout_sessions_id_expire).
An in-progress wallet payment may prevent immediate expiration. A late payment
is held for review and **never** reclaims a released or rebooked court.

### Readiness command

```bash
npm run payments:check -- --activation
```

This checks configuration, venue ownership, migration, RLS, runtime permissions
and callback URLs without creating a payment or webhook. It prints no secrets.
Passing checks do not prove merchant verification, channel activation or delivery.
When both flags are false, `npm run payments:check` confirms the disabled rollout
without connecting to the database or provider.

## 4. Sandbox acceptance before launch

Enable `PAYMONGO_ENABLED=true` in an isolated test environment with approved test
venues and test keys. Use verified player/owner accounts; owners retain MFA.
Every sandbox checkout and receipt is labeled **Test payment**. Do not test on
real customers' reservations.

Verify each of GCash, Maya and QR Ph:

- Correct amount and venue; wallet payment reaches the signed webhook.
- Booking becomes `PENDING_CONFIRMATION`; owner confirmation remains required.
- Refresh/double-click reuse one checkout; repeat webhook delivery is harmless.
- Cancel/failed wallet checkout, missing webhook and status refresh.
- A redirect to `?payment=return` without paying does **not** mark a booking paid.
- Hold expiration/rebooking and subsequent late payment produce review, not a
  resurrected reservation. Arrange the refund manually in the merchant dashboard.
- Foreign users cannot read/start/reconcile another player's payment.
- Owner receipts show a provider reference; no screenshot is requested.
- Scheduler can authenticate, acknowledges requests and has no growing backlog.

API behavior is covered by local mocked-provider and real-Postgres tests. Real
PayMongo sandbox acceptance remains necessary once credentials are available.

## 5. Switch to live

1. Finish merchant verification and enable all intended channels in PayMongo.
2. Disable new sandbox creation; settle/expire all sandbox sessions first. Keep
   their webhook enabled until the queue is drained. A mode switch cannot use
   test credentials to settle live payments.
3. Set `PAYMONGO_MODE=live` and `sk_live_...` credentials for the correct merchants.
4. Register `/api/webhooks/paymongo/<alias>/live` and its **live** signing secret.
5. Redeploy with creation still off, run readiness checks, verify the scheduler.
6. Enable `PAYMONGO_ENABLED=true`, redeploy, and complete a small approved live
   transaction, its owner confirmation, and a manual refund in PayMongo.
7. Monitor webhook delivery, reconciliation errors and pending/review records.

## Recovery and refunds

- **Creation timeout / lost response:** the single booking ledger becomes REVIEW
  (or stale CREATING until the scheduler marks it). Never issue another create
  request for that booking; the provider may have created a chargeable session.
  Recover using its `pikol_checkout_id` metadata/reference in PayMongo and the
  signed webhook. Do not clear the ledger just to retry.
- **REVIEW or UNMATCHED receipt:** compare merchant, session, payment ID, amount,
  currency, booking and recipient in PayMongo. Contact the customer/venue. Local
  review may reflect an already received payment; never ask them to pay twice.
- **Cancelled/rejected/expired paid reservation:** changing booking status does
  not refund a wallet payment. Refund through PayMongo's dashboard and record
  the refund reference operationally. Automated refunds, disputes and payout
  reconciliation are separate work and are not implemented.
- **Additional payment:** preserve the first verified receipt; the extra receipt
  is flagged for reconciliation rather than changing booking history.
- **Webhook outage:** the player's bounded status checks and scheduled job use
  server-side retrieval. Unknown session IDs after lost creation responses need
  a webhook or manual merchant reconciliation.
- **Emergency stop:** set only `PAYMONGO_ENABLED=false`. Keep
  `PAYMONGO_LEDGER_READY=true`, merchant keys, signing secrets and scheduling so
  already started payments can settle. Do not turn off the ledger after collecting
  money. Do not remove merchant routing/credentials before pending sessions drain.

Operator query for unresolved receipts (trusted SQL terminal only):

```sql
SELECT "merchantAlias", mode, "eventId", "sessionId", "paymentId", outcome,
       "amountCents", currency, "receivedAt"
FROM public.payment_webhook_receipts
WHERE outcome IN ('REVIEW', 'UNMATCHED')
ORDER BY "receivedAt" DESC;
```

Do not publish this query's output; payment references are private.
