# Owner Security Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Require authenticator verification before accessing venue workspaces.

**Architecture:** Supabase verifies identity and TOTP assurance; the database
supplies current application permissions. A central session gate protects every
existing page and API, with separate first-factor helpers restricted to sign-in.
MFA runs through a server endpoint to retain HttpOnly session cookies.

**Tech Stack:** Next.js 16, Supabase Auth/SSR, Prisma, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-owner-security-design.md`

## Global Constraints

- Work directly on main; retain existing dependencies and HttpOnly cookies.
- Require TOTP for OWNER, STAFF and ADMIN; CUSTOMER sign-in stays convenient.
- Never derive application permissions from client metadata.
- Never enroll or remove factors on existing production users during testing.

## Review Focus

- AAL1 tokens must fail direct owner API calls as well as workspace rendering.
- Deleted factors and provider errors must fail closed.
- Customer promotion must reach setup without losing its destination or looping.
- Repeated setup must never replace an existing verified authenticator.
- Verification must write cookies but never expose session tokens in JSON.

## Task 1: Session enforcement and MFA API

**Files:** `src/lib/auth/session.ts`, new `src/lib/auth/owner-security.ts`,
new `src/app/api/auth/mfa/route.ts`, `tests/auth/owner-security.test.ts`,
`tests/auth/supabase-session.test.ts`, new `tests/api/owner-mfa.test.ts`.

**Interfaces:** `requiresOwnerMfa(role): boolean`,
`getSignInSession(): Promise<SignInSession | null>`,
`SignInSession extends SessionUser { mfaVerified: boolean }`.
GET `/api/auth/mfa` returns safe verified factor labels/IDs. POST accepts
`{action: 'enroll'}` or `{action: 'verify', factorId, code, next}`.

- [x] Add tests proving first-factor privileged sessions cannot read or mutate,
  live verified TOTP can proceed, stale factors/provider failures deny access,
  and customers cannot spoof roles.
- [x] Run tests and confirm the missing gate causes failures.
- [x] Implement central filtering, preserving the existing per-render cache.
- [x] Test the API's CSRF, factor ownership, repeat enrollment denial, failed code
  behavior, private responses and cookie writes; confirm failures before implementation.
- [x] Implement GET/status, explicit enrollment and challenge/verify. Retain safe
  destinations and do not allow factor removal or expose tokens.
- [x] Run focused security and existing authentication tests.

## Task 2: Sign-in routing and responsive forms

**Files:** new `src/components/auth/OwnerLoginForm.tsx`,
new `src/components/auth/OwnerMfaForm.tsx`, new `(site)/owner/login/page.tsx`,
new `(site)/owner/verify/page.tsx`, existing login/signup/owner layout and venue
landing entry, `src/components/auth/LoginForm.tsx`, README and deployment guide.

**Interfaces:** `OwnerMfaForm({nextPath: string})`,
`OwnerLoginForm({nextPath, authError, preview})`.

- [x] Add form tests for enrollment, existing factor selection, retryable errors,
  no navigation on failed verification and preserved next paths.
- [x] Run tests and confirm missing behavior fails.
- [x] Build dedicated owner first-factor entry and TOTP setup/verification with
  existing shadcn primitives. Reuse the first-factor form without modifying player copy.
- [x] Route existing privileged first-factor sessions to `/owner/verify`, and
  unauthenticated workspace visits to `/owner/login`. Preserve customer onboarding.
- [x] Check 320/390px and desktop layouts, keyboard entry and error feedback.
- [x] Document mandatory MFA and operator-assisted lost-device recovery.
- [x] Run TypeScript, ESLint and full `npm test`, review changes and commit main.
After the implementation commit, push main and verify the Git-triggered Vercel
deployment and public entry. Record deployment evidence in the completion report.

## Verification evidence

- 84 test files / 377 tests passed; TypeScript and changed-file ESLint passed.
- Disposable Supabase accounts confirmed first-factor owner API denial, real
  TOTP setup and verification, HttpOnly cookie upgrade, owner mutation after MFA,
  repeat sign-in challenge and denial of replacement enrollment. Accounts and
  local draft venues were removed after the smoke checks.
- Browser checks passed at 320px, 390px and 1440px without horizontal overflow.
  Setup moves keyboard focus to the QR panel without scrolling past it.
- Independent review found a stale-status factor deletion race and misleading
  provider outage feedback. Both have regression coverage and are resolved.
  Enrollment never deletes factors; provider/network failures are retryable.
- Local sign-in origin checks use the browser Host in development, preserving
  protocol/port checks and production's canonical APP_URL constraint.
