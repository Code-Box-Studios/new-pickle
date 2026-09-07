# RallyPoint Phase 2 — Owner Onboarding + Admin Verification + Publishing

**Date:** 2026-09-07
**Status:** Approved (with amendments, folded in)
**Branch:** `build/owner-onboarding` (off `build/thin-slice`)
**Builds on:** the completed thin slice. The booking engine, double-booking
`EXCLUDE` constraint, holds, idempotency, auth, and all 43 existing tests are the
baseline and must not be destabilized or refactored (Amendment 7).

---

## 0. Objective

Let a real owner self-register a venue, configure it through a resumable wizard,
submit it for review, get approved/rejected by an admin, preview it, and publish
it to the marketplace:

```
Owner: List your venue → Details → Photos → Courts → Hours → Payments → Review
       → Submit → PENDING_REVIEW
Admin: Queue → Review → Approve / Reject (reason)
Owner: Approved → Preview → Publish → LIVE
```

## 1. Decisions (from brainstorming + amendments)

- **Self-serve owner:** any signed-in user creates a venue and is promoted
  `CUSTOMER → OWNER`, with the session cookie re-issued so the role applies at
  once. Owners retain player abilities.
- **Server-persisted draft wizard:** the venue row is the draft; each step saves
  immediately (resumable). Step completion is derived, not stored.
- **Venue-wide recurring hours** applied to all active courts (Amendment 1);
  per-court overrides deferred.
- **Photos via the media storage seam**, stored as `/api/media/...` strings, and
  the media route is **authorization-aware** (Amendment 2), not UUID-secret.
- **One schema addition:** `VenueVerification.submittedNote String?` (Amendment 3).
- **Admin scope:** Approve, Reject, Suspend, Reinstate (Amendment 4).
- **Publish-time server revalidation** of approval + completeness (Amendment 5).
- **Post-submission edit rules** (Amendment 6): `PENDING_REVIEW` is edit-locked;
  `REJECTED` is editable + resubmittable; `APPROVED` is editable but publish
  revalidates.

## 2. Data model changes

Only one field is added:

```prisma
model VenueVerification {
  // ...existing fields...
  submittedNote String?   // owner's business/contact note captured at submit
}
```

Applied via a normal additive migration (`venue_verifications` is a plain table —
no generated-column concerns). Everything else already exists: `Venue.status`,
`Venue.isPublished`, `Venue.photos[]`, `Venue.amenities[]`, `Court`,
`CourtSchedule`, `PaymentMethod`, and the `VenueVerification` review fields
(`status`, `notes`, `reviewedBy`, `reviewedAt`).

**`VenueVerification` field usage:** `status` mirrors the review outcome,
`submittedNote` = owner's note at submit, `notes` = admin's rejection/suspension
reason, `reviewedBy` = admin user id, `reviewedAt` = decision time. `venue.status`
remains the authoritative state used by search/guards; verification holds review
metadata.

## 3. Venue status machine (server-enforced)

`src/lib/venue/status.ts` — a transition table + `assertVenueTransition`,
mirroring the booking state machine.

```
DRAFT            → PENDING_REVIEW            (owner submit, if complete)
PENDING_REVIEW   → APPROVED                  (admin approve)
PENDING_REVIEW   → REJECTED                  (admin reject + reason)
REJECTED         → PENDING_REVIEW            (owner resubmit, if complete)
APPROVED         → SUSPENDED                 (admin suspend + reason)
SUSPENDED        → APPROVED                  (admin reinstate)
```

**Publish is orthogonal to status** — a boolean `isPublished`, not a status:

- Publish is allowed **only when `status = APPROVED`** and the venue passes the
  completeness re-check (§5). Sets `isPublished = true`.
- Unpublish (owner) sets `isPublished = false`; status stays `APPROVED` (dormant).
- **Suspend** (admin) sets `status = SUSPENDED` **and** forces `isPublished =
  false`. A suspended venue is never in search.
- **Reinstate** (admin) sets `status = APPROVED` and **leaves `isPublished =
  false`** — it does **not** auto-relist. The owner must explicitly publish again
  (Amendment 4).

Search visibility (unchanged predicate) is exactly `isPublished = true AND status
= APPROVED`, so pending/rejected/suspended/unpublished venues never appear.

## 4. Completeness (shared by submit and publish)

`src/lib/venue/completeness.ts` → `venueCompleteness(venue): { ok, missing[] }`.
Required:

- **Details:** `name` and `city` present (address/barangay/contact recommended,
  not required for MVP).
- **Photos:** ≥ 1 photo.
- **Courts:** ≥ 1 active court, each active court with a positive `priceCents`
  (**pricing**).
- **Hours:** each active court has ≥ 1 `CourtSchedule` day (operating hours).
- **Payments:** ≥ 1 active `PaymentMethod`.

`missing[]` returns human labels for the Review checklist and for API errors.

## 5. Submit / Publish rules (server-authoritative)

- **Submit** (`DRAFT`/`REJECTED` → `PENDING_REVIEW`): requires
  `venueCompleteness().ok` **and** a non-empty `submittedNote`. Otherwise
  `ValidationError` listing what's missing. Stores `submittedNote`, sets
  `VenueVerification.status = PENDING_REVIEW`.
- **Publish** (Amendment 5): re-checks server-side that `status = APPROVED`
  **and** `venueCompleteness().ok`. If the venue drifted incomplete after
  approval (e.g., the owner deleted the only court), publish is refused with the
  missing list — approval alone is not sufficient.

## 6. Post-submission editing (Amendment 6)

A single guard, `assertVenueEditable(venue)`, gates every owner mutation route:

- `DRAFT` — editable.
- `REJECTED` — editable (then owner resubmits).
- `APPROVED` — editable (publish will revalidate).
- `PENDING_REVIEW` — **locked**: material edits (details, photos, courts, hours,
  payments) return `409 ConflictError("This venue is under review")`. The only
  allowed action is a future "withdraw" (out of scope) — for MVP the owner waits
  for the admin decision.

## 7. Photos + authorization-aware media (Amendment 2)

- Generalize `LocalFsStorage` to accept a subdirectory. Two instances:
  `paymentProofStorage` (`payment-proofs`, unchanged) and **`venueMediaStorage`**
  (`venue-media`).
- Uploaded photos are stored in `venue.photos[]` as the string
  `"/api/media/venue-media/<uuid>.<ext>"`, so `VenueCard`/`Gallery` need no
  changes and seed picsum URLs keep working.
- **`GET /api/media/[...key]`** authorizes per request by resolving the owning
  venue (`venue.findFirst({ where: { photos: { has: "/api/media/" + key } } })`):
  - venue **published** → public (cacheable).
  - venue **unpublished/not approved** → only the owner (or staff/admin) may view
    (preview); everyone else → **404** (not 403, to avoid leaking existence).
  - key belongs to no venue → 404.
  UUID filenames are obfuscation only, never the access control.
- Owner photo API: upload (multipart, ≤5 MB, jpg/png/webp — reusing the storage
  validation), remove (drop from `photos[]`), set-as-cover (move to front).

## 8. API surface

Owner (guarded by `assertVenueAccess`; mutations also by `assertVenueEditable`):

- `POST   /api/owner/venues` — create DRAFT, promote role, re-issue session, return id
- `PATCH  /api/owner/venues/[id]` — details + amenities + houseRules
- `POST   /api/owner/venues/[id]/photos` — upload; `DELETE` (body `{ photo }`) remove; `PATCH` (body `{ photo }`) set cover
- `POST   /api/owner/venues/[id]/courts` — add; `PATCH`/`DELETE /…/courts/[courtId]`
- `PUT    /api/owner/venues/[id]/hours` — venue-wide weekly hours → replace schedules on all active courts
- `POST   /api/owner/venues/[id]/payment-methods` — add; `PATCH`/`DELETE /…/payment-methods/[pmId]`
- `POST   /api/owner/venues/[id]/submit` — body `{ note }`, submit for verification
- `POST   /api/owner/venues/[id]/publish` — publish (revalidates); `POST /…/unpublish`

Admin (guarded by `requireRole("ADMIN")`):

- `POST /api/admin/venues/[id]/approve`
- `POST /api/admin/venues/[id]/reject` — body `{ reason }`
- `POST /api/admin/venues/[id]/suspend` — body `{ reason }`
- `POST /api/admin/venues/[id]/reinstate`

Court delete is refused (409) if the court has bookings in any occupying status
(protects live data); otherwise allowed.

## 9. UI

- **Entry:** `/list-your-venue` (player shell, any signed-in user) — pitch +
  "Create venue" (→ create endpoint → wizard). A "List your venue" link in the
  site header/footer. Logged-out → login with `next`.
- **Owner venues dashboard:** `/owner/venues` — the owner's venues with status +
  live badge and the correct next action (Continue setup / Submit / Preview /
  Publish / Unpublish). "Venues" added to the owner nav beside "Reservations".
- **Wizard:** `/owner/venues/[id]/(details|photos|courts|hours|payments|review)`
  with a shared step-rail shell showing completion ticks. Mobile-first; existing
  design-system components. When `PENDING_REVIEW`, the wizard renders read-only
  with an "under review" banner.
- **Admin:** `/admin/venues?status=` queue + `/admin/venues/[id]` review
  (customer-preview of the venue + submitted note + Approve/Reject/Suspend/
  Reinstate). `/admin` guarded by ADMIN; a minimal admin shell/layout.
- **Preview:** the public venue page `loadVenue` is relaxed so an
  unpublished/unapproved venue is viewable by its owner/admin with a
  "Preview — not live yet" banner; 404 for anyone else. No duplicate rendering.

## 10. Role promotion + session

`POST /api/owner/venues` promotes `User.role` to `OWNER` if currently `CUSTOMER`,
then re-signs the session JWT and sets the cookie in the response so subsequent
`(owner)` navigation passes the guard immediately. ADMIN/STAFF are left as-is.

## 11. Testing (extends the 43 green tests; service-layer + HTTP)

- Venue status transitions: legal allowed, illegal rejected.
- Completeness: detects each missing piece; complete passes.
- Submit guards: incomplete → error with missing list; from `APPROVED` → illegal;
  `REJECTED` → resubmit ok; requires `submittedNote`.
- Publish revalidation: refuses when not `APPROVED`; refuses when approved but
  incomplete; succeeds when approved + complete; unpublish works.
- Suspend/reinstate: suspend forces `isPublished=false` + drops from search;
  reinstate returns `APPROVED` but stays unpublished (no auto-relist).
- Edit-lock: owner mutation on a `PENDING_REVIEW` venue → 409.
- Authorization: owner cannot edit/submit/publish another owner's venue; non-admin
  cannot approve; media route hides unpublished venue media from unrelated users.
- Role promotion on first venue create.
- Search visibility: approved+published appears; pending/suspended/unpublished do not.
- Media upload validation (venue-media instance).

## 12. Verification gate (Amendment 10)

Do not proceed past the gate with failures: `typecheck` + `lint` + full Vitest +
production `build`, plus an **HTTP end-to-end**: create venue (role promoted) →
fill details/photo/court/hours/payment → submit → admin approve → owner publish →
venue appears in search → player books it → owner confirms. Commits are **local
only; do not push** unless explicitly instructed (Amendment: no push).

## 13. Deferred (unchanged; seams ready) — Amendment 8

Sentry connector, interactive map, favorites, reviews-write, notifications, staff
management, owner calendar/ops, walk-ins/blocking, schedule exceptions, per-court
hour overrides, photo drag-reorder, admin content/featured/FAQ, KYC documents.

## 14. Implementation sub-phases (Amendment 9)

1. Schema (`submittedNote`) + `venue/status.ts` + `venue/completeness.ts` + unit tests.
2. Storage generalization + authorization-aware `/api/media` + photo upload API + tests.
3. Owner venue mutation API (create+promote+session, details, courts, hours,
   payments) + `assertVenueEditable` + tests.
4. Owner wizard UI + venues dashboard + `/list-your-venue`.
5. Submit + admin verification API + admin UI + tests.
6. Preview (relaxed `loadVenue`) + publish/unpublish API with revalidation + tests.
7. Verification gate + HTTP e2e.
