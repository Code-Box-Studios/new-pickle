# RallyPoint — Structured Location + Google Maps Link (Design)

**Date:** 2026-09-08
**Status:** Approved design; ready for implementation plan
**Scope:** Small feature, standalone from Phase 7 hardening. No new runtime dependencies.

> This design was adversarially verified against the codebase (read-only workflow,
> 2026-09-08). Verified facts and the security invariants below are load-bearing —
> do not "simplify" them away during implementation.

## Goal

Make a venue's location easier to enter and to find on a map:

1. **Registration:** replace the free-text **City** and **Barangay** inputs with
   **cascading dropdowns** (pick a city → pick a barangay in that city), each with an
   **"Other…"** escape hatch that reveals a free-text box.
2. **Public venue page:** add a **"View on Google Maps"** link. The owner may
   optionally paste their exact Google Maps share link; if they don't, the link falls
   back to an auto-generated Maps **search** URL built from the venue's address.

## Out of scope (deferred)

Barangay search filter · embedded/interactive map · pin-drop map picker · parsing
`lat`/`lng` from a pasted link · full PSGC (nationwide) dataset · JSON-LD `hasMap`/`geo`
enrichment · client-side URL validation (validation stays server-side).

## Locked decisions

- **Data source:** a curated, dependency-free data file for the pilot cities
  (**Davao City**, **Tagum City**) with their barangays, plus an **"Other"** free-text
  fallback for anything not listed.
- **Maps link:** optional owner-pasted link with an **auto-generated search-URL
  fallback**, so the link **always renders** on the venue page.
- **Maps URL scheme:** **https-only** for owner-pasted links (all Google Maps share
  links are https; this removes an http-downgrade vector).
- **Validation:** server-side only, matching the codebase's existing **manual inline
  coercion** style (there is **no zod** and no shared validation schema in this repo —
  do not introduce one).
- **Storage:** store the **raw `mapUrl`** only. Do **not** parse `lat`/`lng` (YAGNI).

---

## Verified current state (evidence)

- **PATCH** `src/app/api/owner/venues/[id]/route.ts` reads the raw body
  (`Record<string, unknown>`), builds a `Prisma.VenueUpdateInput`, and assigns fields
  only when the key `!== undefined`. `city` gets its **own validated branch**
  (trim + reject empty, lines 25-29). `description/addressLine/barangay/contactNumber/
  website/houseRules` flow through a **generic loop** (lines 30-32) that stores
  `b[k] ? String(b[k]) : null` — **no trim, no validation**. Persists via
  `prisma.venue.update({ data, select: { slug: true } })`; guarded by
  `requireEditableOwnVenue(id)`.
- **POST create** `src/app/api/owner/venues/route.ts` reads **only** `name`, hardcodes
  `city: "Davao City"`, creates a `DRAFT`. → **No create-time change needed.** `mapUrl`
  is captured later via the edit/PATCH flow.
- **Reusable `Select`** exists at `src/components/ui/select.tsx` — a styled **native
  `<select>`** (forwardRef + chevron). `SearchBar` already uses it. **Use `Select` +
  `Field`; do not add a third-party/headless dropdown.**
- **Completeness gates on `city` only** (`src/lib/venue/completeness.ts:15`,
  `if (!v.name || !v.city)`). Publish (`publish.ts:12`) and submit-for-review
  (`review.ts:14`) re-check the same. **barangay/addressLine/mapUrl never gate.** →
  Adding optional `mapUrl` and swapping to dropdowns **cannot change gating**, provided
  `city` stays a non-empty string.
- **`locked` prop:** `details/page.tsx:16` sets `locked={v.status === "PENDING_REVIEW"}`;
  `DetailsForm` wraps fields in `<fieldset disabled={locked}>` and hides submit when
  locked. New fields placed inside that fieldset inherit the lock; server backstops via
  `assertVenueEditable`.
- **Public page** `src/app/(site)/venues/[slug]/page.tsx` loads the venue with `include`
  (no `select`), so `venue.mapUrl` is automatically available after the migration +
  `prisma generate`. Location section is at **lines 279-287** (insert after the address
  `<p>`, line 286). External URL → use `<a>`, not `next/link`.
- **Generated Prisma client import path is `@/generated/prisma`** (NOT `@prisma/client`).
- **Prisma 5.22.** Migrations applied via `npm run db:deploy` (`prisma migrate deploy`).
- **Vitest env is `node`** (no jsdom) → only pure helpers + the API route get automated
  tests; the cascading UI is manually verified.
- **Search is exact-equality:** `searchAvailability` uses `where: { city: q.city }`
  (`engine.ts:143`); the search dropdown is `listCities()` = `distinct city` DB strings
  (`venues.ts:4-11`). **No trim/casing normalization anywhere in that path.**

---

## 1. Data model — migration

Add one nullable column to `model Venue` (`prisma/schema.prisma`, near `website`):

```prisma
mapUrl  String?
```

Migration procedure (per `prisma/migrations/README.md`):

1. Edit `schema.prisma`.
2. `prisma migrate dev --create-only --name venue_map_url`.
3. **Hand-edit** the generated `migration.sql` so it contains **exactly one statement**:
   ```sql
   ALTER TABLE "venues" ADD COLUMN "mapUrl" TEXT;
   ```
   Delete any `ALTER COLUMN "period" DROP DEFAULT` / `DROP COLUMN "period"` drift lines,
   and verify the diff touches **nothing** on `bookings.period`, `lat`/`lng`, indexes
   (`@@index([city, isPublished])` is load-bearing for search), or `@@map`.
4. `npm run db:deploy`, then `prisma generate` so `Venue.mapUrl` (`string | null`) is
   typed before it's referenced.

Never run plain `prisma migrate dev` (it would apply the `period` drop).

## 2. Curated location data — `src/lib/location/ph-locations.ts` (new, pure)

```ts
export const OTHER = "Other" as const;

export interface CityLocations { city: string; barangays: string[]; }

export const PH_LOCATIONS: CityLocations[] = [
  { city: "Davao City", barangays: [/* curated set; see below */] },
  { city: "Tagum City", barangays: [/* incl. "Magugpo West", "Magugpo East", … */] },
];

export function cityNames(): string[];              // ["Davao City", "Tagum City"]
export function barangaysForCity(city: string): string[]; // [] if city not curated
```

**City strings are canonical and must byte-match stored values** — exactly
`"Davao City"` and `"Tagum City"` (the schema default is `"Davao City"`). A mismatch
(trailing space, casing) would create a **duplicate search bucket**, since search is
exact-equality. A unit test pins `cityNames()` to exactly these values.

**Barangay scope:** curate a practical, real set per city rather than all ~182 Davao
barangays (each hand-typed entry is a typo risk that becomes an un-mergeable value).
Include at minimum the barangays already present in seed/real data — **Agdao, Buhangin,
Lanang, Matina, Toril** (Davao City) and **Magugpo West** (Tagum City, so the existing
`PickleView` venue prefills to the dropdown rather than "Other"). Source of truth: PSGC.
The exact list is finalized in the implementation plan. Anything not listed uses "Other".

## 3. Maps helper — `src/lib/location/maps.ts` (new, pure, framework-free)

**Must not import `next` or the Prisma client.** Type the argument on a **local
structural interface**, not the generated `Venue` type, so node-env tests and
`venueJsonLd` can both pass plain objects:

```ts
export interface VenueLocation {
  mapUrl: string | null;
  name: string;
  addressLine: string | null;
  barangay: string | null;
  city: string;
}

const ALLOWED_HOSTS = new Set([
  "google.com", "www.google.com", "maps.google.com",
  "maps.app.goo.gl", "goo.gl",
]);

export function isValidMapUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:") return false;                 // https-only
  return ALLOWED_HOSTS.has(u.hostname.toLowerCase());        // EXACT host match
}

export function venueMapUrl(v: VenueLocation): string {
  if (v.mapUrl && isValidMapUrl(v.mapUrl)) return v.mapUrl;  // re-validate stored value
  const q = [v.name, v.addressLine, v.barangay, v.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
```

Rules the implementation must honor (each covered by a unit test):

- `isValidMapUrl`: `new URL()` in try/catch (garbage → `false`, never throws);
  **https only**; **exact** `hostname` membership (never `endsWith`/substring — blocks
  `google.com.evil.com`); lowercase the hostname. `javascript:`, `data:`, `vbscript:`,
  `http:` and off-allowlist hosts all → `false`.
- `venueMapUrl`: returns the stored `mapUrl` **only if it re-passes `isValidMapUrl`**,
  otherwise the constructed fallback. The fallback origin is a hardcoded literal
  (`www.google.com/maps`), so there is **no open-redirect**; the only requirement is
  that the `query` value is `encodeURIComponent`-encoded and null/empty parts are
  filtered out (no `"null"`/stray commas).

## 4. Registration form — `src/components/venue-admin/DetailsForm.tsx`

Replace the free-text City/Barangay `<Input>`s with `Field` + `Select` cascades, and add
an optional Google Maps link `<Input>`. All new controls go **inside** the existing
`<fieldset disabled={locked}>`.

**State model** — keep the existing `f` object (so the PATCH body shape for `city`/
`barangay` stays plain strings) and add two local "choice" states:

- `cityChoice`: the `<select>` value — a curated city **or** `OTHER`.
  Initialize `cityChoice = cityNames().includes(initial.city) ? initial.city : OTHER`.
- `barangayChoice`: similarly initialized against `barangaysForCity(initial.city)`.

Behavior:

- **City `<select>`**: options = `cityNames()` + `"Other…"`. On change: if value !== `OTHER`,
  `set("city", value)` and `cityChoice = value`; if `OTHER`, `cityChoice = OTHER` and
  reveal an `<Input>` bound to `f.city`. **Changing city resets barangay** (a Davao
  barangay is invalid under Tagum): clear `f.barangay` and reset `barangayChoice`.
- **Barangay `<select>`**: options = `barangaysForCity(resolvedCity)` + `"Other…"`.
  When city is `OTHER` (custom), there are no curated barangays → the barangay path is
  effectively free-text via "Other". Reveal `<Input>` bound to `f.barangay` when
  `barangayChoice === OTHER`.
- **"Other" is UI-only and must never be persisted as a literal value.** On submit,
  `city`/`barangay` in the payload are the typed free-text when the choice is `OTHER`.
  If `OTHER` is chosen with an empty text box, the form must block save (city) / send
  `null` (barangay) — it must never send the string `"Other"`.
- **Google Maps link**: `<Field label="Google Maps link (optional)"><Input id="mapUrl"
  inputMode="url" value={f.mapUrl ?? ""} …/></Field>`, placed near the Website field.
  The form stays lenient; a bad link is rejected server-side and surfaced through the
  existing error **toast** (`DetailsForm.tsx:69`).

**Touch-points that are easy to miss** (all required for round-trip):

- `Initial` interface: add `mapUrl: string | null`.
- `save()` payload: add `mapUrl: f.mapUrl`.
- `src/app/(owner)/owner/venues/[id]/details/page.tsx` `initial={{…}}`: add
  `mapUrl: v.mapUrl` (loader already returns the full row — no query change).

## 5. API validation — PATCH `src/app/api/owner/venues/[id]/route.ts`

Add a **dedicated validated branch** (mirroring the `city` branch). **Do NOT** append
`mapUrl` to the generic loop at lines 30-32 — that loop neither trims nor validates, so
it would **bypass the allowlist and store a `javascript:` URL** (see Security).

```ts
import { isValidMapUrl } from "@/lib/location/maps";
// …after the generic optional-string loop:
if (b.mapUrl !== undefined) {
  const raw = b.mapUrl == null ? "" : String(b.mapUrl).trim();
  if (raw === "") {
    data.mapUrl = null;
  } else {
    if (!isValidMapUrl(raw)) throw new ValidationError("Enter a valid Google Maps link");
    data.mapUrl = raw;
  }
}
```

Defensive: reject `city === "Other"` (and treat `barangay === "Other"` as null) at the
route as a belt-and-suspenders guard against a client mapping bug. No change to
completeness/publish gating (nothing here enters `venueCompleteness`).

Optional length caps: `mapUrl` ≤ 2048 chars; custom city/barangay ≤ 100 chars.

## 6. Public venue page — `src/app/(site)/venues/[slug]/page.tsx`

In the Location `<section>` (after the address `<p>`, line 286, before `</section>`):

```tsx
<a
  href={venueMapUrl(venue)}
  target="_blank"
  rel="noopener noreferrer"                 // mandatory: blocks reverse-tabnabbing
  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
>
  <MapPin className="size-4" aria-hidden /> View on Google Maps
</a>
```

`MapPin` is already imported. The link renders **unconditionally** (the helper always
returns a URL — owner link when valid, search fallback otherwise). Import `venueMapUrl`
from `@/lib/location/maps`.

## Security invariants (must hold)

1. **The public page renders `href={venueMapUrl(venue)}` — never `href={venue.mapUrl}`
   directly.** `venueMapUrl` re-runs `isValidMapUrl` on the stored value and falls back
   to the trusted constructed URL, so a malicious stored value (`javascript:`, `data:`,
   off-allowlist host — written by a seed script, admin tool, direct DB, or a future
   importer that bypasses PATCH) can never become a live href. Write-time validation is
   defense-in-depth, **not** the sole gate.
2. `rel="noopener noreferrer"` on the external link is **mandatory**.
3. The fallback search URL has a **hardcoded** `www.google.com/maps` origin; only its
   `query` value is derived from venue text and it is `encodeURIComponent`-encoded.

## Behavior notes / accepted trade-offs

- **"Other" cities create their own search bucket.** Because the public SearchBar's city
  list is `distinct` published `city` strings with no normalization, an owner who types a
  custom city gets a new bucket once published, and near-duplicates (`Panabo`/`Panabo
  City`) would not merge. For the pilot this is accepted; curated cities are canonical.
  Future work (out of scope): shared read-side city normalization across PATCH-write,
  `listCities`, and search.
- **Existing rows:** `My venue` = `Davao City` (no barangay) prefills the city dropdown
  and leaves barangay unset. `PickleView` = `Tagum City` / `Magugpo West` prefills both
  **iff** `Magugpo West` is in the curated Tagum list (it will be); otherwise it falls to
  the "Other" prefill (still correct). Before shipping, run one query of `distinct
  venue.city` and reconcile any whitespace/case variants against the canonical strings.

## Testing plan

Automated (vitest, node env):

- **`maps.ts`**: `isValidMapUrl` accepts each allowlisted https host (incl.
  `maps.app.goo.gl`, `goo.gl`), rejects off-allowlist (`google.com.evil.com`,
  `evilgoogle.com`), rejects `http:`/`javascript:`/`data:`/`vbscript:`/garbage;
  `venueMapUrl` passes through a valid stored link, **falls back** for an invalid/hostile
  stored link, and builds a clean encoded query with **null `addressLine`/`barangay`**
  (no `"null"`, no double commas).
- **`ph-locations.ts`**: `cityNames()` equals exactly `["Davao City", "Tagum City"]` and
  equals the schema default for city; `barangaysForCity("Tagum City")` includes
  `"Magugpo West"`; unknown city → `[]`.
- **PATCH route**: stores a trimmed valid `mapUrl`; nulls empty; **400s** an off-allowlist
  URL; rejects `city: "Other"`. Follows existing owner-venue route test patterns.
- **Regression**: a test pinning that `city` remains the only location field entering
  `venueCompleteness` (mapUrl/barangay never gate publish).

Manual: the cascading City→Barangay dropdowns, "Other" reveal + prefill for existing
venues, city-change-resets-barangay, and the "View on Google Maps" link on the public
page (owner-link case and fallback case).

## File manifest

**Create**
- `src/lib/location/ph-locations.ts`
- `src/lib/location/maps.ts`
- `tests/location/maps.test.ts`
- `tests/location/ph-locations.test.ts`
- `prisma/migrations/<ts>_venue_map_url/migration.sql`

**Modify**
- `prisma/schema.prisma` (add `Venue.mapUrl String?`)
- `src/components/venue-admin/DetailsForm.tsx` (cascading selects + mapUrl field + payload)
- `src/app/(owner)/owner/venues/[id]/details/page.tsx` (pass `mapUrl` into `initial`)
- `src/app/api/owner/venues/[id]/route.ts` (dedicated `mapUrl` validation branch)
- `src/app/(site)/venues/[slug]/page.tsx` (View on Google Maps link)
- `tests/api/owner-venue-*.test.ts` (extend for `mapUrl`) + completeness regression test

## Constraints

- No new runtime dependencies. No zod. Import Prisma types from `@/generated/prisma`.
- Keep `src/lib/location/*` free of `next`/prisma imports (node-testable).
- Local per-step commits; **do not push** unless explicitly told.
