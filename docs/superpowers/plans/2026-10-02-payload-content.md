# Payload Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Edit RallyPoint marketing content using Payload at `/cms`.

**Architecture:** Payload's official Next admin in an isolated root layout, Postgres `cms` schema, existing ADMIN session authentication. Published globals feed existing server-rendered marketing pages.

**Tech Stack:** Payload 3.90.2, Next 16.3.8, React 19.2.4, Postgres, Prisma, shadcn.

**Spec:** `docs/superpowers/specs/2026-10-02-payload-content-design.md`

## Global Constraints
- Work directly on `main`, no approval questions or pushes.
- Payload packages all pinned to 3.90.2; upgrade Next and eslint-config-next together to 16.3.8.
- Admin `/cms`, REST `/api/cms`; Prisma owns `public`, Payload owns `cms`.
- Only current database ADMIN users can read/edit CMS. Disable local password auth and public registration.
- Published content only on public pages; retain drafts and versions.
- Credit: `Powered by Code Box Studios`.

## Review Focus
- Forged or expired cookies and revoked ADMIN roles must deny CMS access.
- First-time anonymous requests must not create CMS users or register accounts.
- Drafts must not leak onto public pages or anonymous REST endpoints.
- External and protocol-relative login redirects must resolve to the role's normal home.
- Repeat seeding must not erase published edits; CSS must stay isolated between editor and app.

### Task 1: Secure editor and storage

**Files:** `src/payload.config.ts`, `src/cms/auth.ts`, `src/cms/access.ts`, `src/cms/migrations/`, `src/app/(payload)/`, `src/app/(frontend)/`, `next.config.mjs`, `.env.example`, authentication request/verify/login files, `tests/cms/auth.test.ts`, `tests/auth/redirect.test.ts`.

**Interfaces:** `resolveCmsAdmin(headers: Headers): Promise<SessionUser|null>` verifies the cookie and current DB role. `safeNextPath(value: unknown): string|undefined` accepts only local paths. Payload custom strategy returns a persisted linked `cms-users` record after authorization.

- [x] Write and run failing auth tests for anonymous, forged, owner, revoked-admin, and valid-admin headers; use real signed cookies and DB users.
- [x] Write and run failing safe redirect tests for local `/cms`, external URL, protocol-relative URL, backslash URL, and invalid type.
- [x] Install matched dependencies, isolate layouts without URL changes, configure CMS access/strategy, generate migration and import map/types, add validated magic link destination.
- [x] Apply CMS migration locally; verify public Prisma tables remain intact and security tests pass.

### Task 2: Editable published marketing content

**Files:** `src/cms/globals.ts`, `src/cms/defaults.ts`, `src/cms/content.ts`, `scripts/seed-cms.ts`, public homepage/layout/venue landing, `src/components/nav/SiteHeader.tsx`, admin navigation, `tests/cms/content.test.ts`.

**Interfaces:** `getHomeContent()`, `getSiteContent()`, `getVenueLandingContent()` return typed published/default content. Seed command creates only missing globals.

- [x] Write and run failing real-Payload tests for draft versus published reads and denied anonymous global/user mutations.
- [x] Configure three globals, required fields and safe links, version history; seed current copy without overwriting existing content.
- [x] Wire public pages/header/footer to published content; add admin CMS navigation.
- [x] Prove saving a draft preserves published copy, publishing updates public copy, and repeated seed preserves edits. Restore verification edits.

### Task 3: Verify, document, commit

**Files:** README, package scripts, this plan's completion notes.

- [x] Document environment, migration/seed, existing admin login, and draft/publish workflow.
- [x] Run lint, typecheck, complete Vitest suite, production build; inspect outputs and resolve concrete failures.
- [x] Browser-check CMS login/editor, draft/publish, public desktop/mobile header and custom dropdowns, owner dialog selection, app/editor CSS isolation.
- [x] Review complete diff, restore generated build info, stage only task files and commit on main.

## Execution notes
- User's explicit autonomous instruction replaces the skill's approval handoff.
- UI redesign will be committed separately before CMS integration; all application dropdowns are being changed to custom Radix menus in that UI commit.

## Completion evidence

- Task 1 complete: Payload 3.90.2 / Next 16.3.8 installed with matching peer ranges. Existing URLs preserved under `(frontend)`; CMS has its own root. Migration creates only schema `cms`, and all public booking engine tests still pass.
- Task 2 complete: three editable globals are seeded and wired to published server content. Browser verified actual Save Draft -> public copy unchanged, Publish changes -> updated homepage, then restored original headline. Anonymous CMS/REST requests and owner sessions are denied. Existing admin magic links preserve `/cms`; CMS sign-out clears the shared application cookie.
- Task 3 complete: 55 files / 244 tests pass; typecheck, lint, production build and postbuild pass. Browser verified 320px signed-in header, menu focus, footer credit above mobile navigation, teal CTA contrast, and custom Select inside an owner booking dialog (2-hour selection, focus restored, no booking submitted). Production standalone serves app and CMS CSS plus public imagery.
- Ruling: use Next 16.3.8 and Payload 3.90.2 together because published peers and current framework fixes require updating the previous Next 16.2.10 baseline.
- Ruling: keep pre-existing workspace `.ignore`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.gitignore` setup changes out of the UI/CMS commits.
- Ruling: explicitly create schema `cms` in the initial migration; the generated Payload migration omitted it and failed on a new database before any tables were created. Fixed migration succeeds on both app and test databases.
- Ruling: Payload's Postgres adapter retains a connection for reconnect handling. The one-shot seed script follows Payload CLI convention and exits after awaited writes, cleanup, and Prisma disconnect; it no longer waits indefinitely for pool shutdown.
- Review found three important edge cases. Real failing tests reproduced unpublished draft leakage and overwriting a first saved draft. Public reads now require `_status: published`, seed checks version history, and a 2-second content deadline plus 1.5-second database timeouts provide fallback during stalls. Targeted 8 tests and full 244-test suite pass. Follow-up independent read-only review reports no remaining critical or important issues.
- Standalone build now copies public assets and static chunks in postbuild, resolving confirmed missing production CSS assets.
