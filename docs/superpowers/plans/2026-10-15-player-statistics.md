# Player statistics implementation plan

> **For agentic workers:** Use superpowers:executing-plans with TDD. Independent UI work may run after the browser-safe contract is written. One independent final review covers the feature.

**Goal:** Build optional booking rosters, private attendance history, and confirmed or self-reported match statistics.
**Architecture:** Bookings retain ownership and payment control. Roster membership grants only session participation. PostgreSQL stores immutable result revisions, votes, and audit events; summaries derive from eligible completed sessions. All booking-related changes use the existing booking lock.
**Tech Stack:** Next.js, Prisma/PostgreSQL, Supabase Auth, shadcn, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-15-player-statistics.md`.

## Global constraints

- Work directly on main and preserve unrelated changes. The user's continue instruction accepts the written scope; their standing instruction waives further approval prompts.
- Guests require only a nickname. Booking remains possible without a roster.
- Private profiles and history; no venue/admin role bypass for player participation data.
- Statistics require a completed booking whose actual Manila end time has passed.
- Registered players confirm their own attendance and results. Guests' attendance is explicitly holder-reported.
- Preserve old revisions and disputes. Corrections require fresh confirmations.
- Pasalo exchanges holder permissions and revokes unused invites, preserving accepted participants and guests.
- No public rankings, official rating, or implied actual playing duration.

## Review focus

- A stale holder request during Pasalo transfer must fail after the booking lock.
- Invitation tokens must never appear in server URLs or stored plaintext; accepting never lets clients assign another account.
- A changed attendance or disputed/corrected result must immediately change all derived totals without duplicating matches.
- Sessions around UTC midnight must use actual Manila time, including completed future bookings.
- History, guest names, contact information, and result controls must not leak across accounts or venue roles.

### Task 1: Optional roster and invitations

Files: `prisma/schema.prisma`, additive player migration, `src/lib/players/{types,core,roster,invitations}.ts`, `tests/players/roster.test.ts`, `tests/db.ts`.
Interfaces: `addGuest(userId,bookingId,nickname)`, `joinRoster(userId,bookingId,nickname?)`, `removePlayer(userId,bookingId,participantId)`, `leaveRoster(userId,bookingId)`, `createInvitation(userId,bookingId,label?)`, `acceptInvitation(userId,token,nickname?)`, `declineInvitation(userId,token)`, `revokeInvitation(userId,bookingId,id)`.

- [x] Write and run failing tests for guests without contacts, repeated guest names, owner-only management, consent, invitation replay/expiry/revocation, and actor impersonation.
- [x] Add private models, indexes, checks, and RLS. Limit active roster plus outstanding invitations to 32; retain removed entries for audit.
- [x] Implement locked access and invitations. Hash random 24-byte tokens; expire before the game or after seven days. Invitations require a confirmed booking; self/guest roster setup can happen earlier.
- [x] Run `npm test -- tests/players/roster.test.ts`; expected all pass.

### Task 2: Attendance and results

Files: `src/lib/players/{attendance,matches,rules}.ts`, `tests/players/results.test.ts`.
Interfaces: `setAttendance(userId,bookingId,participantId,attendance)`, `createMatch(userId,bookingId,input)`, `reviseMatch(userId,matchId,expectedRevision,input)`, `voteMatch(userId,matchId,expectedRevision,decision)`.

- [x] Write and run failing tests for time/completion gates, self-only attendance, guest reports, invalid teams, singles/doubles, multiple games, stale revisions, duplicate votes, disputes, and correction confirmation.
- [x] Implement immutable revisions and votes. Participants need reported/confirmed attendance before being selected for a result. Only matched registered players vote; holders can record guest-only games.
- [x] Run `npm test -- tests/players/results.test.ts`; expected all pass.

### Task 3: Private reads, statistics, and HTTP routes

Files: `src/lib/players/{read,statistics,http}.ts`, `src/app/api/players/[...path]/route.ts`, `tests/players/{statistics,api}.test.ts`.
Interfaces: DTOs in `src/lib/players/types.ts`; `rosterView(userId,bookingId)`, `playerDashboard(userId,before?)`, `matchHistory(userId,matchId,before?)`.

- [x] Write and run failing aggregate/privacy/HTTP tests. Include multiple matches, mixed guest games, zero win rate, disputed results, attendance corrections, pagination, malformed input, and cross-origin writes.
- [x] Derive totals with parameterized SQL across all eligible records; page session and revision history. Read data only for current holder or active participants.
- [x] Add authenticated same-origin mutation routes with bounded JSON and private no-store responses. Invitation lookup is public POST with a token in the body. A short-lived HttpOnly cookie preserves the token across sign-in without URL queries.
- [x] Run `npm test -- tests/players`; expected all pass.

### Task 4: Responsive interface and booking integration

Files: new `src/components/players/*`, new `/players` pages, existing booking pages/navigation, `src/lib/pasalo/service.ts`, `tests/ui/players.test.tsx`, `tests/players/transfer.test.ts`.

- [x] Build profile, private history, roster, invitation, and result controls with shadcn and existing teal/green styling. Booking has an optional roster card; accepted participants use a separate session page without payment access.
- [x] Write failing transfer tests; revoke unused invitations inside Pasalo's booking transaction and preserve other roster entries.
- [x] Verify responsive 320px and desktop layouts in a browser using local fixtures. Correct the prior Pasalo input length mismatches.
- [x] Run full tests, lint, typecheck, and build; request an independent review and fix important findings with regressions.
- [x] Update scope status/README, commit verified changes on main. Report production deployment separately; production requires the additive migrations.

## Verification and review

Implemented on main. Final verification: 624 tests passed across 113 files;
ESLint, TypeScript, and the production build passed. Local migrations applied.
The nine new player tables passed an RLS and browser-privilege audit.
Local browser fixtures verified dashboard, roster, invitations, and game forms
at 320px, plus the dashboard at 1440px, without horizontal overflow or console
errors. Fixtures were removed before the production build.

One independent review found no Critical issues. Regressions reproduced and
fixed private pending-session pagination, duplicate game creation after lost
responses, and stale private data after access ended. Each underlying failure
was observed before its fix. The final full suite passed after the fix pass.

Decisions: invitation tokens use fragments and a ten-minute HttpOnly cookie
through sign-in; the original invitation must be reopened if that cookie expires.
A seller's explicit Add myself choice preserves ordinary participation after
Pasalo, so sellers must leave before start when no longer playing. Rosters freeze
at scheduled start, preventing retrospective additions.

Follow-up: the server now returns canLeave from active membership and the actual
Manila start-time gate. The UI uses that permission instead of booking status.
Both the backend boundary and UI regression were observed failing before the fix.
Follow-up verification: 626 tests passed across 113 files; ESLint and TypeScript
passed. Production deployment remains pending; apply both player migrations
before publishing this version.
