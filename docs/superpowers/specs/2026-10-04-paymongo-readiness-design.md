# PayMongo readiness

## Intent and constraints

Prepare Pikol now so verified PayMongo accounts can be activated with configuration and a sandbox acceptance check. Keep working directly on main, preserve the current manual venue-payment flow, and keep live collection disabled. The user has asked for autonomous implementation without further questions.

## Architecture

Use hosted Checkout v2, server-only Basic authentication, and the existing PHP booking total. GCash, Maya (`paymaya`) and QR Ph (`qrph`) are configurable per merchant. Only explicit venue IDs owned by the configured merchant owner may use its credentials. Multiple merchants use separate environment-key references and webhook URLs; never route unrelated venues through the platform account. PayMongo Connect onboarding/settlement is a separate commercial integration if the platform must collect for other owners.

Create a private, unique payment checkout per booking plus an idempotent webhook receipt ledger. Store expected amount/currency, merchant alias, mode, recipient owner, hold expiry, provider IDs, status and review reason. No raw webhook billing payloads or secrets in the database. PaymentSubmission.proofKey becomes nullable for verified provider receipts, and QRPH joins the payment channel enum. Existing manual submissions still require proof.

Creation is explicitly disabled by default. A separate ledger-ready flag permits safe rollout before production migrations: ordinary booking reads must not reference new tables until migrations and runtime permissions have been applied. Turning checkout off after activation does not stop webhook settlement or receipt reads.

## Payment and booking behavior

An authorized customer requests checkout for their PENDING_PAYMENT, unexpired, local online booking. Lock creation through a unique booking row. Repeated clicks reuse the same session; concurrent creation and ambiguous failures never automatically create a second chargeable session. Persist an attempt before the remote call and use its ID in provider metadata so a webhook can recover a lost create response. Bound remote calls to eight seconds and expose only approved PayMongo HTTPS checkout URLs.

Return URLs do not mean payment success. The status page asks the server to reconcile a stored session; webhooks verify HMAC-SHA256 over timestamp + raw body, constant-time comparison, the appropriate test/live signature, and a five-minute timestamp tolerance. Separate merchant/mode endpoints. Parse documented legacy and current event envelopes, acknowledge unrelated events, and deduplicate by event ID or stable session/payment identity.

Verified amount, PHP currency, mode, merchant, reference and payment source must match the private checkout. An eligible paid booking moves atomically to PAYMENT_SUBMITTED then PENDING_CONFIRMATION; the venue still confirms it. Record an actual provider receipt without a fabricated screenshot. Late, cancelled, conflicting or mismatched payments become review items and never revive a released slot. Do not initiate refunds automatically; the launch runbook explains merchant-led reconciliation/refunds.

Block mixing manual proof with an active/uncertain hosted checkout. Fix expiry writes to compare current hold status so stale expiry scans cannot overwrite verified payment. No external API calls inside database transactions. Notify after committed settlement; notification failure cannot roll back a payment.

## UI and operations

When configured, show branded hosted checkout and accurate test-mode copy, hold countdown and pending/paid/review states using existing shadcn components. Disabled or unlinked venues retain manual payment. The return/status component performs a bounded server check, with explicit retry if needed. Owner receipt UI accepts verified provider receipts without a screenshot.

Provide server-only environment examples, a non-mutating readiness command, deployment/migration/runtime-role instructions, separate test/live webhook URLs, dashboard registration steps and a checklist for sandbox payments, duplicate delivery, wrong amounts and late payments. No keys, merchant activation, webhook registration, real charges or refunds during this preparation.

## Verification

Use real local Postgres integration tests for uniqueness, receipt idempotency, conditional expiry, authorization and booking transitions; deterministic provider HTTP fixtures for all methods, errors, ambiguous create and retrieval; signature/body tampering and mode tests; responsive component/browser checks. Run the complete suite, TypeScript, lint and a fresh security review before publishing disabled code.

## Primary references

- https://docs.paymongo.com/docs/payment-channels-hosted-checkout
- https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start
- https://docs.paymongo.com/reference/create_checkout_sessions_2
- https://docs.paymongo.com/reference/get_checkout_sessions
- https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
- https://docs.paymongo.com/docs/developer-tools-best-practices
