# PayMongo Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare disabled, tested hosted PayMongo checkout and verified payment settlement for activation after merchant verification.
**Architecture:** Keep existing venue payment and booking interfaces. Add a private checkout ledger, isolated provider client and explicit merchant configuration; signed webhooks and server reconciliation share atomic settlement.
**Tech Stack:** Next.js 16, TypeScript, Prisma 5/Postgres, Supabase Auth, Vitest, shadcn.
**Spec:** docs/superpowers/specs/2026-10-04-paymongo-readiness-design.md

## Global Constraints

- Main directly; no branch/worktree, no live keys/charges/merchant activation.
- Default disabled; GCash/Maya/QR Ph use provider IDs gcash/paymaya/qrph.
- PHP totals are server authoritative; no added customer fee.
- Never route a venue to another owner's merchant or expose secrets/raw billing.
- Eight-second HTTP timeout; five-minute signature tolerance; no network in DB transactions.
- Private ledger tables use RLS and trusted runtime-only grants.

## Review Focus

- Lost create response/concurrent clicks must not create duplicate chargeable sessions.
- Duplicate/out-of-order payment delivery must not repeat history or downgrade payment.
- Released/rebooked slots must never be resurrected by late money or stale expiry scans.
- Disabled rollout and merchant credential mistakes must preserve existing payments.
- Return URLs and foreign clients must not fabricate payment/redirect to arbitrary hosts.

### Task 1: Provider boundary

**Files:** src/lib/payments/paymongo/{config,client,webhook}.ts; tests/payments/paymongo-provider.test.ts; .env.example.
**Interfaces:** merchantForVenue(venueId,ownerId), merchantByAlias(alias,mode), createCheckout/getCheckout/expireCheckout, verifyWebhook(raw,header,merchant), parsePaidEvent(payload).
- [ ] Write tests for disabled/misconfigured/mismatched merchant/mode, exact server-priced HTTP request, timeout/unsafe URL sanitization, raw HMAC tampering/replay and both envelopes; run RED.
- [ ] Implement provider boundary with secret environment references, Checkout v2 creation, v1 retrieval/expiry and normalized paid receipt; run GREEN.

### Task 2: Durable checkout and settlement

**Files:** prisma/schema.prisma; additive migration; src/lib/payments/paymongo/{checkout,settlement}.ts; src/lib/booking/local-backend.ts; src/lib/payment.ts; tests/payments/paymongo-checkout.test.ts; tests/db.ts.
**Interfaces:** startCheckout(bookingId,userId,role), reconcileCheckout(bookingId), settlePayment(merchant,event), checkoutForBooking(bookingId), publicCheckoutStatus(checkout).
- [ ] Write integration tests proving unique creation, amount ownership, ambiguous create quarantine, duplicate settlement, stale/cancelled/mismatched review, manual conflict and conditional expiry; run RED.
- [ ] Add nullable proof, QRPH, private checkout/receipt tables with indexes/checks/RLS/runtime-role permissions, generate/apply local migration and implement atomic settlement; run GREEN.

### Task 3: Authorized routes and payment UI

**Files:** src/app/api/bookings/[id]/checkout/route.ts; src/app/api/bookings/[id]/checkout/status/route.ts; src/app/api/webhooks/paymongo/[merchant]/[mode]/route.ts; src/components/booking/PayMongoPayment.tsx; booking completion/status pages; owner reservation receipt; tests/api/paymongo.test.ts; tests/payments/paymongo-ui.test.tsx.
**Interfaces:** POST checkout returns only checkoutUrl or next; POST status returns sanitized receipt state; signed webhook returns durable acknowledgement. Existing manual payment remains unchanged when disabled.
- [ ] Write API/UI authorization, CSRF, payload limits, return-not-paid, bounded retry and provider-receipt tests; run RED.
- [ ] Implement routes and shadcn UI with ledger-ready read gate; run GREEN and inspect mobile/browser.

### Task 4: Activation tools and verification

**Files:** scripts/paymongo-check.mjs; package.json; docs/deployment/paymongo.md; README.md; readiness tests.
**Interfaces:** npm run payments:check reads configuration/table/RLS/permissions status, never creates payment or webhook.
- [ ] Add readiness tests proving disabled no-secret deployment and failed readiness exits; run RED.
- [ ] Implement command, environment examples and migration/webhook/sandbox/activation/refund runbook; run GREEN.
- [ ] Run npm test, npm run typecheck, changed-file ESLint, browser checks and fresh security review; fix concrete findings with RED/GREEN.
- [ ] Commit prepared code on main, publish with all payment activation flags still disabled and verify deployed legacy flows.
