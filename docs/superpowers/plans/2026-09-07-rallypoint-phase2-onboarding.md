# RallyPoint Phase 2 Implementation Plan — Owner Onboarding + Admin Verification + Publishing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let an owner self-register a venue, configure it via a resumable wizard, submit it for review, get approved/rejected by an admin, preview it, and publish it — server-enforced throughout, without touching the booking engine.

**Architecture:** New `venue/` service modules (status machine, completeness, editable guard) hold pure, tested logic. Thin owner/admin route handlers call them + Prisma, guarded by `assertVenueAccess` / `requireRole("ADMIN")`. Photos reuse a subdir-generalized `LocalFsStorage` behind an authorization-aware `/api/media` route. UI = RSC pages + client forms, matching the thin slice.

**Tech Stack:** Next.js 16 App Router, Prisma 5.22 + PostgreSQL 16, Vitest, Tailwind 4, Radix, jose.

## Global Constraints

- Preserve the thin-slice booking engine + `bookings_no_overlap` EXCLUDE constraint; do not refactor it.
- `venue.status` is authoritative; search predicate is exactly `isPublished = true AND status = "APPROVED"`.
- Publish requires `status = APPROVED` **and** `venueCompleteness().ok` (re-checked server-side).
- `PENDING_REVIEW` is edit-locked; `REJECTED`/`APPROVED`/`DRAFT` editable.
- Reinstate returns `APPROVED` but leaves `isPublished = false` (no auto-relist).
- Media access control is per-request via the owning venue's publish state — never UUID-secrecy.
- Only schema change: `VenueVerification.submittedNote String?`. Apply with `prisma migrate dev --create-only` edited if needed, then `db:deploy`; never plain `migrate dev` (generated-column drift on `bookings`).
- Money in centavos. Roles `CUSTOMER|OWNER|STAFF|ADMIN`. Mutations return domain-error→HTTP via `errorResponse`.
- Commits local only; do not push. Branch `build/owner-onboarding`.

---

## Sub-phase 1 — Schema + venue status machine + completeness

### Task 1.1: `submittedNote` migration

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_venue_submitted_note/migration.sql`

- [ ] Add `submittedNote String?` to `VenueVerification`.
- [ ] `npx prisma migrate dev --create-only --name venue_submitted_note` → verify the SQL is only `ALTER TABLE "venue_verifications" ADD COLUMN "submittedNote" TEXT;` (delete any stray `bookings.period` line if present). Apply with `npm run db:deploy`; `npm run db:generate`.
- [ ] Commit `feat: add VenueVerification.submittedNote`.

### Task 1.2: venue status machine

**Files:** Create `src/lib/venue/status.ts`; Test `tests/venue/status.test.ts`
**Produces:** `assertVenueTransition(from, to)`, `canVenueTransition(from,to)`, `ConflictError` (add to `src/lib/booking/errors.ts` if absent).

- [ ] Add `ConflictError` (409, code `conflict`) to `src/lib/booking/errors.ts`.
- [ ] Test (legal + illegal):
```ts
import { describe, it, expect } from "vitest";
import { canVenueTransition } from "@/lib/venue/status";
describe("venue status machine", () => {
  it("allows DRAFT->PENDING_REVIEW, PENDING_REVIEW->APPROVED/REJECTED", () => {
    expect(canVenueTransition("DRAFT","PENDING_REVIEW")).toBe(true);
    expect(canVenueTransition("PENDING_REVIEW","APPROVED")).toBe(true);
    expect(canVenueTransition("PENDING_REVIEW","REJECTED")).toBe(true);
  });
  it("allows REJECTED->PENDING_REVIEW resubmit and APPROVED<->SUSPENDED", () => {
    expect(canVenueTransition("REJECTED","PENDING_REVIEW")).toBe(true);
    expect(canVenueTransition("APPROVED","SUSPENDED")).toBe(true);
    expect(canVenueTransition("SUSPENDED","APPROVED")).toBe(true);
  });
  it("forbids DRAFT->APPROVED and APPROVED->PENDING_REVIEW", () => {
    expect(canVenueTransition("DRAFT","APPROVED")).toBe(false);
    expect(canVenueTransition("APPROVED","PENDING_REVIEW")).toBe(false);
  });
});
```
- [ ] Implement:
```ts
import type { VenueStatus } from "@/generated/prisma";
import { ConflictError } from "@/lib/booking/errors";
const T: Record<VenueStatus, VenueStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  REJECTED: ["PENDING_REVIEW"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
};
export function canVenueTransition(from: VenueStatus, to: VenueStatus) { return T[from]?.includes(to) ?? false; }
export function assertVenueTransition(from: VenueStatus, to: VenueStatus) {
  if (!canVenueTransition(from, to)) throw new ConflictError(`Cannot move venue from ${from} to ${to}`);
}
/** Owner may edit unless the venue is under review. */
export function assertVenueEditable(status: VenueStatus) {
  if (status === "PENDING_REVIEW") throw new ConflictError("This venue is under review and can't be edited right now");
}
```
- [ ] Run tests → pass. Commit `feat: venue status machine + editable guard`.

### Task 1.3: completeness

**Files:** Create `src/lib/venue/completeness.ts`; Test `tests/venue/completeness.test.ts`
**Produces:** `venueCompleteness(v): { ok: boolean; missing: string[] }` where `v` includes `courts` (with `schedules`) and `paymentMethods`.

- [ ] Test: a venue missing photos/courts/hours/payments reports each; a full one is `ok`.
- [ ] Implement (input typed to the Prisma include shape):
```ts
type Input = {
  name: string | null; city: string | null; photos: string[];
  courts: { active: boolean; priceCents: number; schedules: { id: string }[] }[];
  paymentMethods: { active: boolean }[];
};
export function venueCompleteness(v: Input): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!v.name || !v.city) missing.push("Venue name and city");
  if (v.photos.length === 0) missing.push("At least one photo");
  const activeCourts = v.courts.filter((c) => c.active);
  if (activeCourts.length === 0) missing.push("At least one active court");
  if (activeCourts.some((c) => c.priceCents <= 0)) missing.push("A price for every court");
  if (activeCourts.some((c) => c.schedules.length === 0)) missing.push("Operating hours");
  if (!v.paymentMethods.some((p) => p.active)) missing.push("At least one payment method");
  return { ok: missing.length === 0, missing };
}
```
- [ ] Add `src/lib/venue/queries.ts` with `venueForCompleteness(id)` (Prisma include of courts+schedules+paymentMethods) reused by submit/publish.
- [ ] Run tests → pass. Commit `feat: venue completeness`.

---

## Sub-phase 2 — Media storage + authorization-aware route + photo API

### Task 2.1: generalize storage

**Files:** Modify `src/lib/storage/local-fs-storage.ts` (constructor `subdir`), `src/lib/storage/index.ts` (export `venueMediaStorage`); Test `tests/storage/venue-media.test.ts`
**Consumes:** existing `PaymentProofStorage` interface, `ALLOWED_PROOF_TYPES`, `MAX_PROOF_BYTES`.
**Produces:** `paymentProofStorage`, `venueMediaStorage` (both `PaymentProofStorage`); `LocalFsStorage(subdir: string)`.

- [ ] Refactor `LocalFsStorage` to take `subdir` in the constructor (default `payment-proofs`); `save` writes `${subdir}/<uuid>.<ext>` and returns that key; `getBytes` guards traversal under `ROOT/<subdir>`.
- [ ] `index.ts`: `export const paymentProofStorage = new LocalFsStorage("payment-proofs"); export const venueMediaStorage = new LocalFsStorage("venue-media");`
- [ ] Test: venueMediaStorage round-trips a png with key under `venue-media/`; rejects bad type/size.
- [ ] Run → pass. Commit `feat: generalize storage; add venueMediaStorage`.

### Task 2.2: authorization-aware media route

**Files:** Create `src/app/api/media/[...key]/route.ts`, `src/lib/venue/media-access.ts`; Test `tests/api/media-access.test.ts`
**Produces:** `venueForMediaKey(key)`, `canViewVenueMedia(venue, session)`.

- [ ] `media-access.ts`:
```ts
import prisma from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
export async function venueForMediaKey(key: string) {
  return prisma.venue.findFirst({
    where: { photos: { has: `/api/media/${key}` } },
    select: { id: true, ownerId: true, isPublished: true, status: true },
  });
}
export async function canViewVenueMedia(
  venue: { ownerId: string; isPublished: boolean; status: string },
  session: SessionUser | null,
): Promise<boolean> {
  if (venue.isPublished && venue.status === "APPROVED") return true;
  if (!session) return false;
  if (session.role === "ADMIN" || session.id === venue.ownerId) return true;
  // staff
  const staff = await prisma.venueStaff.findFirst({ where: { userId: session.id } });
  return !!staff;
}
```
- [ ] Route `GET /api/media/[...key]`: resolve venue; if none → 404. If `canViewVenueMedia` false → 404 (avoid existence leak). Else stream `venueMediaStorage.getBytes(key)` with `Cache-Control: public, max-age=3600` when published else `private, no-store`.
- [ ] Test (service-level): published venue → anyone true; unpublished → owner/admin true, stranger false; unknown key → null.
- [ ] Run → pass. Commit `feat: authorization-aware /api/media route`.

### Task 2.3: owner photo API

**Files:** Create `src/app/api/owner/venues/[id]/photos/route.ts`; helper `src/lib/api/owner-venue-access.ts`
**Produces:** `requireOwnVenue(id)` → `{ session, venue }` (asserts `assertVenueAccess`); used by all owner venue routes.

- [ ] `owner-venue-access.ts`: load venue (with fields needed), `assertVenueAccess(session.id, session.role, venueId)`, return `{ session, venue }`. A variant `requireEditableOwnVenue(id)` also calls `assertVenueEditable(venue.status)`.
- [ ] `POST` (multipart, one `file`): `requireEditableOwnVenue`; `venueMediaStorage.save`; append `/api/media/${key}` to `photos`. `DELETE` (json `{ photo }`): remove from array. `PATCH` (json `{ photo }`): move to front (cover). Return `{ photos }`.
- [ ] Covered by the P2 HTTP e2e; no separate unit test required beyond storage validation.
- [ ] Commit `feat: owner venue photo API`.

---

## Sub-phase 3 — Owner venue mutation API (create/promote, details, courts, hours, payments)

### Task 3.1: create venue + role promotion + session reissue

**Files:** Create `src/app/api/owner/venues/route.ts`, `src/lib/venue/slug.ts`; Test `tests/api/owner-venue-create.test.ts` (service-level promotion)
**Produces:** `uniqueVenueSlug(name)`; `promoteToOwner(userId)` in `src/lib/auth/promote.ts`.

- [ ] `slug.ts`: slugify(name) + ensure unique (suffix `-<n>` on collision).
- [ ] `promote.ts`: `promoteToOwner(userId)` → if user.role === "CUSTOMER" set "OWNER"; return the updated role.
- [ ] `POST /api/owner/venues`: `requireUser`; create `Venue { status: DRAFT, isPublished:false, city:"Davao City", name: body.name||"My venue", slug, ownerId, photos:[], amenities:[] }`; `promoteToOwner`; if promoted, re-sign session and `res.cookies.set(sessionCookie(await signSession({...})))`; return `{ id }`.
- [ ] Test: creating a venue as a CUSTOMER promotes them to OWNER (call `promoteToOwner` + assert role).
- [ ] Commit `feat: create venue + owner role promotion`.

### Task 3.2: details / courts / hours / payments routes

**Files:** Create `src/app/api/owner/venues/[id]/route.ts` (PATCH details), `.../courts/route.ts` (POST) + `.../courts/[courtId]/route.ts` (PATCH/DELETE), `.../hours/route.ts` (PUT), `.../payment-methods/route.ts` (POST) + `.../payment-methods/[pmId]/route.ts` (PATCH/DELETE)
**Consumes:** `requireEditableOwnVenue`.
**Test:** `tests/api/owner-venue-edit.test.ts` — edit-lock + court-delete-with-bookings.

- [ ] PATCH details: update name/description/addressLine/barangay/city/contactNumber/website/amenities/houseRules (validate name/city non-empty when provided). Regenerate slug only if name changed and venue still DRAFT.
- [ ] Courts: POST add `{ name, indoor, covered, surface, capacity, priceCents, active }`; PATCH edit; DELETE — refuse (`ConflictError`) if the court has any booking in an occupying status, else delete (cascades its schedules).
- [ ] Hours PUT: body `{ days: { dayOfWeek, openMinute, closeMinute }[] }` (0–6, closed days omitted). In a transaction, for every active court: delete its `CourtSchedule` rows, then create the provided days. (Venue-wide hours → all active courts.)
- [ ] Payment methods: POST/PATCH/DELETE `{ channel, accountName, accountNumber, instructions, active }`.
- [ ] Every mutation calls `requireEditableOwnVenue` first (so PENDING_REVIEW → 409).
- [ ] Test: mutate a PENDING_REVIEW venue → `ConflictError`; delete a court with an occupying booking → `ConflictError`.
- [ ] Commit `feat: owner venue details/courts/hours/payments API + edit-lock`.

---

## Sub-phase 4 — Owner wizard UI + dashboard + entry

### Task 4.1: entry + dashboard + owner nav

**Files:** Create `src/app/(site)/list-your-venue/page.tsx`, `src/components/venue-admin/CreateVenueButton.tsx` (client), `src/app/(owner)/owner/venues/page.tsx`; Modify `src/app/(owner)/layout.tsx` (add "Venues" nav), `src/components/nav/SiteHeader.tsx` (+ footer link "List your venue").

- [ ] `/list-your-venue` (player shell): pitch; if signed in → `CreateVenueButton` (POST `/api/owner/venues` → redirect `/owner/venues/[id]/details`); if not → link to `/login?next=/list-your-venue`.
- [ ] `/owner/venues`: list the owner's venues (status badge via a `VenueStatusBadge`, live/dormant), each with the correct next action (Continue setup / Submit / Preview / Publish / Unpublish) linking into the wizard/actions; a "List another venue" button.
- [ ] Commit `feat: list-your-venue entry + owner venues dashboard`.

### Task 4.2: wizard shell + steps

**Files:** Create `src/app/(owner)/owner/venues/[id]/layout.tsx` (step rail + under-review banner), `.../details/page.tsx`, `.../photos/page.tsx`, `.../courts/page.tsx`, `.../hours/page.tsx`, `.../payments/page.tsx`, `.../review/page.tsx`; client forms under `src/components/venue-admin/` (`DetailsForm`, `PhotoManager`, `CourtEditor`, `HoursEditor`, `PaymentMethodEditor`, `ReviewSubmit`), `src/components/venue-admin/VenueStatusBadge.tsx`.
**Contract:** step layout loads the venue (owner-scoped) + computes completeness; renders a rail with per-step done ticks (details: name+city; photos: ≥1; courts: ≥1 active; hours: active courts have schedules; payments: ≥1). When `status==="PENDING_REVIEW"`, forms render read-only with a banner. Each form posts to its route then `router.refresh()`; "Next" links to the next step.

- [ ] Build the layout + six step pages/forms (mobile-first; existing UI primitives; native inputs for time/day where practical). `HoursEditor` = 7 day rows (closed toggle + open/close time selects), one "apply to all days" helper, saved venue-wide.
- [ ] Build → verify responsive. Commit `feat: owner onboarding wizard UI`.

---

## Sub-phase 5 — Submit + admin verification

### Task 5.1: submit API

**Files:** Create `src/app/api/owner/venues/[id]/submit/route.ts`; Test `tests/api/venue-submit.test.ts`
**Consumes:** `requireOwnVenue`, `assertVenueTransition`, `venueCompleteness`, `venueForCompleteness`.

- [ ] `POST` body `{ note }`: load venue for completeness; `assertVenueTransition(status, "PENDING_REVIEW")` (so only DRAFT/REJECTED); if `!note?.trim()` → ValidationError; if `!completeness.ok` → ValidationError(missing.join); else in a tx set `venue.status="PENDING_REVIEW"` and upsert `VenueVerification { status:"PENDING_REVIEW", submittedNote:note }`.
- [ ] Test: incomplete → error listing missing; from APPROVED → ConflictError; complete+note from DRAFT → PENDING_REVIEW; REJECTED→resubmit ok.
- [ ] Commit `feat: submit venue for verification`.

### Task 5.2: admin API + queue UI

**Files:** Create `src/app/api/admin/venues/[id]/{approve,reject,suspend,reinstate}/route.ts`, `src/lib/venue/review.ts`, `src/app/(admin)/layout.tsx`, `src/app/(admin)/admin/page.tsx` (→ venues), `src/app/(admin)/admin/venues/page.tsx` (queue), `src/app/(admin)/admin/venues/[id]/page.tsx` (review), client `src/components/admin/ReviewActions.tsx`; Test `tests/api/admin-review.test.ts`
**Produces:** `reviewVenue(venueId, to, adminId, reason?)` applying `assertVenueTransition`, updating `venue.status` (+ `isPublished=false` on SUSPEND) and `VenueVerification { status, notes:reason, reviewedBy, reviewedAt }` in one tx.

- [ ] `review.ts`: one function for approve/reject/suspend/reinstate via `to`. Suspend sets `isPublished=false`; reinstate leaves `isPublished` false.
- [ ] Admin routes: `requireRole("ADMIN")` then `reviewVenue(...)`.
- [ ] `(admin)` layout: ADMIN-guard (redirect non-admins to `/login`); minimal shell.
- [ ] Queue page: venues filtered by `?status=` (default PENDING_REVIEW). Review page: customer-preview of the venue (reuse venue rendering pieces) + submitted note + `ReviewActions` (Approve / Reject+reason / Suspend+reason / Reinstate depending on current status).
- [ ] Test: approve → APPROVED + verification reviewed; reject → REJECTED + reason; suspend → SUSPENDED + isPublished false; reinstate → APPROVED + still unpublished; non-admin → ForbiddenError.
- [ ] Commit `feat: admin verification queue + approve/reject/suspend/reinstate`.

---

## Sub-phase 6 — Preview + publish

### Task 6.1: preview (relax loadVenue)

**Files:** Modify `src/app/(site)/venues/[slug]/page.tsx`
- [ ] Change `loadVenue` to fetch by slug regardless of publish/status, then: if published+APPROVED → show normally; else if session is owner/admin → show with a "Preview — not live yet" banner; else `notFound()`. Keep availability rendering as-is (a preview may have courts/hours). Commit `feat: owner/admin venue preview`.

### Task 6.2: publish/unpublish with revalidation

**Files:** Create `src/app/api/owner/venues/[id]/publish/route.ts`, `.../unpublish/route.ts`; Test `tests/api/venue-publish.test.ts`
- [ ] `publish`: `requireOwnVenue`; load for completeness; if `status !== "APPROVED"` → ConflictError; if `!venueCompleteness().ok` → ValidationError(missing); else set `isPublished=true`.
- [ ] `unpublish`: set `isPublished=false` (status unchanged).
- [ ] Test: publish when not APPROVED → error; APPROVED but incomplete (delete court) → error listing missing; APPROVED+complete → published & appears in `searchAvailability`; unpublish → disappears.
- [ ] Commit `feat: publish/unpublish with server revalidation`.

---

## Sub-phase 7 — Gate

### Task 7.1: verification gate + HTTP e2e

- [ ] `npm run typecheck` · `npm run lint` · `npm test` (all prior + new green) · `npm run build`.
- [ ] HTTP e2e script (dev server, curl + cookie jars): sign in new user → `POST /api/owner/venues` (assert role promoted via a follow-up authed owner route working) → PATCH details → upload photo → add court → PUT hours → add payment method → `POST submit` → sign in admin → `POST approve` → owner `POST publish` → assert the venue now appears in `/search` results / availability → player books a slot → owner confirms → `CONFIRMED`. Assert media of an unpublished venue is 404 to a stranger and 200 to owner.
- [ ] Commit `chore: Phase 2 verification gate green`.

---

## Self-Review

**Spec coverage:** §2 schema → 1.1. §3 status machine → 1.2. §4 completeness → 1.3. §5 submit/publish → 5.1/6.2. §6 edit-lock → 1.2 (`assertVenueEditable`) + 3.2. §7 media authz → 2.1/2.2/2.3. §8 API surface → 3.x/5.x/6.x. §9 UI → 4.x/5.2/6.1. §10 role promotion → 3.1. §11 testing → tests across tasks. §12 gate → 7.1. §13 deferred → not built. §14 sub-phases → mirror these.

**Placeholder scan:** none — logic modules carry full code; routes/UI carry exact files + contracts.

**Type consistency:** `assertVenueTransition`/`canVenueTransition`/`assertVenueEditable` (1.2), `venueCompleteness` (1.3), `venueForCompleteness` (1.3), `requireOwnVenue`/`requireEditableOwnVenue` (2.3), `venueForMediaKey`/`canViewVenueMedia` (2.2), `promoteToOwner`/`uniqueVenueSlug` (3.1), `reviewVenue` (5.2) — each defined once and referenced by exact name.
