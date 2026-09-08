# RallyPoint — Structured Location + Google Maps Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners pick City → Barangay from cascading dropdowns (with an "Other" free-text fallback) and optionally paste a Google Maps link, and show a "View on Google Maps" link on the public venue page.

**Architecture:** One additive nullable column (`Venue.mapUrl`). Two new pure, node-testable modules under `src/lib/location/` (`ph-locations.ts` curated data + helpers; `maps.ts` URL validation/build). The owner registration form (`DetailsForm`) swaps its free-text City/Barangay inputs for the existing native `Select` component and adds an optional maps-link input. The PATCH route validates `mapUrl` through a pure helper. The public venue page renders `venueMapUrl(venue)` — never the raw stored value.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Prisma 5.22 + PostgreSQL 16, Vitest (node env). No new runtime dependencies.

**Design spec:** `docs/superpowers/specs/2026-09-08-rallypoint-venue-location-maps-design.md`.

## Global Constraints

- **No new runtime dependencies. No zod** (this repo uses manual inline coercion — match it).
- **Import the Prisma client/types from `@/generated/prisma`**, never `@prisma/client`.
- **`src/lib/location/*` must not import `next` or the Prisma client** (so node-env Vitest can import them directly). `maps.ts` may import `ValidationError` from `@/lib/booking/errors` (that module is pure — only `Error` subclasses).
- **Security invariant:** the public page renders `href={venueMapUrl(venue)}`, NEVER `href={venue.mapUrl}`. `venueMapUrl` re-validates the stored value and falls back to a trusted URL. The external link MUST have `rel="noopener noreferrer"`. `isValidMapUrl` is **https-only** with **exact** hostname allowlist.
- **City dropdown values are canonical exact strings** (`"Davao City"`, `"Tagum City"`) — search is exact-equality with no normalization. The **literal string `"Other"` must never be persisted** as a city or barangay.
- **Migrations:** never run plain `prisma migrate dev`. Use `--create-only`, strip the spurious `period` drift lines, then `npm run db:deploy` + `prisma generate`.
- **Commits:** local per-task commits. **Do NOT `git push`** until explicitly told.
- **Verify after every task:** `npm run typecheck` (exit 0) → `npm run lint` (exit 0) → `npm test` (all green). PostgreSQL must be up (`docker compose up -d`, host port 55432).

## File Structure

**Create**
- `src/lib/location/ph-locations.ts` — curated `PH_LOCATIONS` data + `cityNames()`, `barangaysForCity()`, `OTHER` sentinel. Pure.
- `src/lib/location/maps.ts` — `isValidMapUrl()`, `venueMapUrl()`, `normalizeMapUrlInput()`, `VenueLocation` interface. Pure.
- `tests/location/ph-locations.test.ts`
- `tests/location/maps.test.ts`
- `prisma/migrations/<timestamp>_venue_map_url/migration.sql`

**Modify**
- `prisma/schema.prisma` — add `Venue.mapUrl String?`.
- `src/app/api/owner/venues/[id]/route.ts` — dedicated `mapUrl` branch + reject `city === "Other"`.
- `tests/api/venue-review.test.ts` — add a gating-regression test (mapUrl/barangay don't block publish).
- `src/components/venue-admin/DetailsForm.tsx` — cascading City/Barangay selects + optional maps-link input + `mapUrl` in payload.
- `src/app/(owner)/owner/venues/[id]/details/page.tsx` — pass `mapUrl` into `initial`.
- `src/app/(site)/venues/[slug]/page.tsx` — add the "View on Google Maps" link.

---

## Task 1: Add `Venue.mapUrl` column

**Files:**
- Modify: `prisma/schema.prisma` (model `Venue`)
- Create: `prisma/migrations/<timestamp>_venue_map_url/migration.sql`

**Interfaces:**
- Produces: `Venue.mapUrl` typed `string | null` on the generated client (consumed by Tasks 4, 5, 6).

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, in `model Venue`, add a line next to the other nullable strings (e.g. directly after the `website String?` field):

```prisma
  mapUrl        String?
```

- [ ] **Step 2: Generate the migration WITHOUT applying it**

Run: `npx prisma migrate dev --create-only --name venue_map_url`
This creates `prisma/migrations/<timestamp>_venue_map_url/migration.sql`. It does not apply.

- [ ] **Step 3: Strip drift so the migration is exactly one statement**

Open the new `migration.sql`. Delete every line that is not the `mapUrl` add — in particular any `ALTER TABLE "bookings" ALTER COLUMN "period" DROP DEFAULT;` / `ALTER TABLE "bookings" DROP COLUMN "period";` drift lines and their `-- AlterTable` comment blocks. The file must contain **exactly**:

```sql
ALTER TABLE "venues" ADD COLUMN "mapUrl" TEXT;
```

Verify it touches nothing on `bookings`, `period`, `lat`/`lng`, indexes, or `@@map`.

- [ ] **Step 4: Apply and regenerate the client**

Run: `npm run db:deploy && npx prisma generate`
Expected: migration applies cleanly; the client regenerates so `Venue.mapUrl` is typed.

- [ ] **Step 5: Verify nothing broke**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (no code references `mapUrl` yet).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(venue): add nullable mapUrl column"
```

---

## Task 2: Curated location data + helpers

**Files:**
- Create: `src/lib/location/ph-locations.ts`
- Test: `tests/location/ph-locations.test.ts`

**Interfaces:**
- Produces: `OTHER: "Other"`; `interface CityLocations { city: string; barangays: string[] }`; `PH_LOCATIONS: CityLocations[]`; `cityNames(): string[]`; `barangaysForCity(city: string): string[]`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// tests/location/ph-locations.test.ts
import { describe, it, expect } from "vitest";
import { cityNames, barangaysForCity, OTHER } from "@/lib/location/ph-locations";

describe("ph-locations", () => {
  it("exposes exactly the two canonical pilot cities", () => {
    expect(cityNames()).toEqual(["Davao City", "Tagum City"]); // canonical, byte-exact
  });

  it("lists all 23 Tagum barangays including Magugpo West", () => {
    const brgys = barangaysForCity("Tagum City");
    expect(brgys).toHaveLength(23);
    expect(brgys).toContain("Magugpo West");
  });

  it("lists Davao barangays including the real seed names", () => {
    const brgys = barangaysForCity("Davao City");
    expect(brgys).toEqual(expect.arrayContaining(["Agdao", "Buhangin", "Toril"]));
    expect(brgys).not.toContain("Lanang"); // not an official barangay
    expect(brgys).not.toContain("Matina"); // split into Aplaya/Crossing/Pangi
  });

  it("returns an empty list for an unknown/custom city or the sentinel", () => {
    expect(barangaysForCity("Panabo City")).toEqual([]);
    expect(barangaysForCity("Other")).toEqual([]);
  });

  it("exports the Other sentinel", () => {
    expect(OTHER).toBe("Other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/location/ph-locations.test.ts`
Expected: FAIL (module `@/lib/location/ph-locations` not found).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/location/ph-locations.ts
export const OTHER = "Other" as const;

export interface CityLocations {
  city: string;
  barangays: string[];
}

// Canonical city strings MUST byte-match stored/searched values (search is exact-equality).
// Barangays are a curated real subset (source: PSGC / PhilAtlas); "Other" covers the rest.
export const PH_LOCATIONS: CityLocations[] = [
  {
    city: "Davao City",
    barangays: [
      "Agdao", "Buhangin", "Toril", "Talomo Proper", "Ma-a", "Bucana",
      "Sasa", "Panacan", "Matina Aplaya", "Matina Crossing", "Matina Pangi",
      "Catalunan Grande", "Catalunan Pequeño", "Bago Aplaya", "Bago Gallera",
      "Dumoy", "Mintal", "Cabantian", "Communal", "Tigatto", "Mandug",
      "Waan", "Tibungco", "Ilang", "Vicente Hizon Sr.", "Bunawan Proper",
      "Calinan", "Baguio",
    ],
  },
  {
    city: "Tagum City",
    barangays: [
      "Apokon", "Bincungan", "Busaon", "Canocotan", "Cuambogan", "La Filipina",
      "Liboganon", "Madaum", "Magdum", "Magugpo East", "Magugpo North",
      "Magugpo Poblacion", "Magugpo South", "Magugpo West", "Mankilam",
      "New Balamban", "Nueva Fuerza", "Pagsabangan", "Pandapan", "San Agustin",
      "San Isidro", "San Miguel", "Visayan Village",
    ],
  },
];

export function cityNames(): string[] {
  return PH_LOCATIONS.map((l) => l.city);
}

export function barangaysForCity(city: string): string[] {
  return PH_LOCATIONS.find((l) => l.city === city)?.barangays ?? [];
}
```

> Note: `"Catalunan Pequeño"` contains `ñ` (U+00F1) — keep the file UTF-8 and preserve it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/location/ph-locations.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/location/ph-locations.ts tests/location/ph-locations.test.ts
git commit -m "feat(location): curated pilot city/barangay data + helpers"
```

---

## Task 3: Maps URL helper (validation, build, input coercion)

**Files:**
- Create: `src/lib/location/maps.ts`
- Test: `tests/location/maps.test.ts`

**Interfaces:**
- Consumes: `ValidationError` from `@/lib/booking/errors`.
- Produces: `interface VenueLocation { mapUrl: string | null; name: string; addressLine: string | null; barangay: string | null; city: string }`; `isValidMapUrl(url: string): boolean`; `venueMapUrl(v: VenueLocation): string` (always returns a URL); `normalizeMapUrlInput(raw: unknown): string | null` (throws `ValidationError` on a non-empty invalid link). `isValidMapUrl`/`normalizeMapUrlInput` consumed by Task 4; `venueMapUrl` consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/location/maps.test.ts
import { describe, it, expect } from "vitest";
import { isValidMapUrl, venueMapUrl, normalizeMapUrlInput } from "@/lib/location/maps";
import { ValidationError } from "@/lib/booking/errors";

describe("isValidMapUrl", () => {
  it("accepts https Google Maps hosts including share shorteners", () => {
    for (const url of [
      "https://www.google.com/maps/place/Foo",
      "https://google.com/maps?q=1,2",
      "https://maps.google.com/?q=1,2",
      "https://maps.app.goo.gl/abc123",
      "https://goo.gl/maps/abc123",
    ]) expect(isValidMapUrl(url)).toBe(true);
  });

  it("rejects look-alike and off-allowlist hosts (exact match only)", () => {
    for (const url of [
      "https://google.com.evil.com/maps",
      "https://evilgoogle.com/maps",
      "https://maps.example.com/",
    ]) expect(isValidMapUrl(url)).toBe(false);
  });

  it("rejects non-https and dangerous schemes", () => {
    for (const url of [
      "http://www.google.com/maps",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "vbscript:msgbox(1)",
    ]) expect(isValidMapUrl(url)).toBe(false);
  });

  it("returns false (never throws) for garbage", () => {
    expect(isValidMapUrl("not a url")).toBe(false);
    expect(isValidMapUrl("")).toBe(false);
  });
});

describe("venueMapUrl", () => {
  const base = { mapUrl: null, name: "Ace Pickle", addressLine: null, barangay: null, city: "Davao City" };

  it("passes through a valid stored owner link", () => {
    expect(venueMapUrl({ ...base, mapUrl: "https://maps.app.goo.gl/abc" }))
      .toBe("https://maps.app.goo.gl/abc");
  });

  it("falls back to a search URL for a hostile/invalid stored link", () => {
    const url = venueMapUrl({ ...base, mapUrl: "javascript:alert(1)" });
    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(url).not.toContain("javascript");
  });

  it("builds the fallback query skipping null parts and encoding special chars", () => {
    const url = venueMapUrl({ ...base, name: "A&B Courts" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("A&B Courts, Davao City"),
    );
    expect(url).not.toContain("null");
  });
});

describe("normalizeMapUrlInput", () => {
  it("returns null for blank/nullish input", () => {
    expect(normalizeMapUrlInput(undefined)).toBeNull();
    expect(normalizeMapUrlInput(null)).toBeNull();
    expect(normalizeMapUrlInput("   ")).toBeNull();
  });

  it("trims and returns a valid link", () => {
    expect(normalizeMapUrlInput("  https://maps.app.goo.gl/x  ")).toBe("https://maps.app.goo.gl/x");
  });

  it("throws ValidationError for a non-Google link", () => {
    expect(() => normalizeMapUrlInput("https://example.com")).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/location/maps.test.ts`
Expected: FAIL (module `@/lib/location/maps` not found).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/location/maps.ts
import { ValidationError } from "@/lib/booking/errors";

/** Structural subset — deliberately NOT the Prisma Venue type, so this stays node-testable. */
export interface VenueLocation {
  mapUrl: string | null;
  name: string;
  addressLine: string | null;
  barangay: string | null;
  city: string;
}

const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

export function isValidMapUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;          // https-only
  return ALLOWED_HOSTS.has(u.hostname.toLowerCase()); // exact host match, never endsWith
}

/** Always returns a usable URL: the owner's link when valid, else a trusted search URL. */
export function venueMapUrl(v: VenueLocation): string {
  if (v.mapUrl && isValidMapUrl(v.mapUrl)) return v.mapUrl;
  const query = [v.name, v.addressLine, v.barangay, v.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Coerce owner form input: null when blank, trimmed valid link, else ValidationError. */
export function normalizeMapUrlInput(raw: unknown): string | null {
  const value = raw == null ? "" : String(raw).trim();
  if (value === "") return null;
  if (!isValidMapUrl(value)) throw new ValidationError("Enter a valid Google Maps link");
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/location/maps.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/location/maps.ts tests/location/maps.test.ts
git commit -m "feat(location): Google Maps URL validation + build helpers"
```

---

## Task 4: Wire `mapUrl` into the PATCH route + gating regression test

**Files:**
- Modify: `src/app/api/owner/venues/[id]/route.ts`
- Test: `tests/api/venue-review.test.ts` (add one test; reuses existing `completeDraftVenue`/`admin`)

**Interfaces:**
- Consumes: `normalizeMapUrlInput` (Task 3), `Venue.mapUrl` (Task 1), and the existing `completeDraftVenue`/`admin` helpers + `publishVenue` in the test file.

- [ ] **Step 1: Write the gating-regression test**

Add to `tests/api/venue-review.test.ts` inside the existing `describe("venue submit / review / publish", …)` block (the file already imports `publishVenue` and defines `admin()` + `completeDraftVenue()`):

```ts
  it("a Google Maps link and a null barangay never block publish (gating unchanged)", async () => {
    const a = await admin();
    const { venue } = await completeDraftVenue();
    // set a maps link and clear barangay — neither is part of the completeness gate
    await prisma.venue.update({
      where: { id: venue.id },
      data: { mapUrl: "https://maps.app.goo.gl/abc123", barangay: null },
    });
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    await expect(publishVenue(venue.id)).resolves.toBeUndefined(); // publishes fine
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).isPublished).toBe(true);
  });
```

- [ ] **Step 2: Run it — confirm it passes (behavior guard)**

Run: `npx vitest run tests/api/venue-review.test.ts`
Expected: PASS. This pins that `mapUrl`/`barangay` are irrelevant to completeness/publish. (It is green immediately — the route change below must not regress it.)

- [ ] **Step 3: Add the `mapUrl` branch + `"Other"` guard to the PATCH route**

In `src/app/api/owner/venues/[id]/route.ts`:

Add the import beside the other `@/lib` imports:
```ts
import { normalizeMapUrlInput } from "@/lib/location/maps";
```

Harden the existing `city` block so the UI sentinel can never be stored (replace lines 25-29):
```ts
    if (b.city !== undefined) {
      const city = String(b.city).trim();
      if (!city) throw new ValidationError("City can't be empty");
      if (city === "Other") throw new ValidationError("Please choose or type a real city");
      data.city = city;
    }
```

Add a dedicated `mapUrl` branch **after** the amenities block (after line 35, before the `prisma.venue.update` call). Do NOT add `mapUrl` to the generic trim/null loop — it needs validation:
```ts
    if (b.mapUrl !== undefined) {
      data.mapUrl = normalizeMapUrlInput(b.mapUrl);
    }
```

- [ ] **Step 4: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (the gating test from Step 1 still passes; `normalizeMapUrlInput` is already covered by Task 3).

- [ ] **Step 5: Manual verification (route not unit-tested by convention)**

Confirm with the app running (`npm run dev`, DB up): editing a venue and saving a valid `maps.app.goo.gl` link persists it; saving `https://example.com` returns a 400 surfaced as a toast; the literal city `"Other"` is rejected. (Route handlers are covered by the HTTP e2e smoke, not unit tests — this manual pass stands in for that here.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/owner/venues/[id]/route.ts" tests/api/venue-review.test.ts
git commit -m "feat(venue): validate & persist optional Google Maps link on PATCH"
```

---

## Task 5: Cascading City/Barangay dropdowns + maps-link field in `DetailsForm`

**Files:**
- Modify: `src/components/venue-admin/DetailsForm.tsx`
- Modify: `src/app/(owner)/owner/venues/[id]/details/page.tsx`

**Interfaces:**
- Consumes: `cityNames`, `barangaysForCity`, `OTHER` (Task 2); the existing `Select` (`@/components/ui/select`), `Field`/`Input` (`@/components/ui/input`); `Venue.mapUrl` (Task 1). The PATCH route (Task 4) already accepts `mapUrl`, `city`, `barangay`.
- Produces: a form that sends `city`/`barangay` as plain resolved strings (never `"Other"`) plus `mapUrl` in its PATCH body.

*No automated test — Vitest is node-env (no jsdom). Verified by typecheck/lint/build + manual steps below.*

- [ ] **Step 1: Pass `mapUrl` into the form's `initial`**

In `src/app/(owner)/owner/venues/[id]/details/page.tsx`, add to the `initial={{ … }}` object (loader already returns the full row):
```tsx
        mapUrl: v.mapUrl,
```

- [ ] **Step 2: Extend the form's `Initial` interface and imports**

In `src/components/venue-admin/DetailsForm.tsx`:

Add imports near the top:
```ts
import { Select } from "@/components/ui/select";
import { cityNames, barangaysForCity, OTHER } from "@/lib/location/ph-locations";
```

Add to the `Initial` interface (after `city: string;`):
```ts
  mapUrl: string | null;
```

- [ ] **Step 3: Add cascading-select state**

After `const [f, setF] = useState(initial);` (and the `set`/`toggle` helpers), add:
```ts
  const [cityChoice, setCityChoice] = useState(
    cityNames().includes(initial.city) ? initial.city : OTHER,
  );
  const [brgyChoice, setBrgyChoice] = useState<string>(() => {
    if (!initial.barangay) return "";
    return barangaysForCity(initial.city).includes(initial.barangay) ? initial.barangay : OTHER;
  });

  function onCityChange(value: string) {
    setCityChoice(value);
    set("city", value === OTHER ? "" : value); // never store the "Other" sentinel
    setBrgyChoice("");                          // city changed → reset barangay
    set("barangay", null);
  }

  function onBarangayChange(value: string) {
    setBrgyChoice(value);
    if (value === OTHER) set("barangay", "");   // reveal text box for free entry
    else set("barangay", value || null);        // "" placeholder → null
  }
```

- [ ] **Step 4: Replace the free-text City and Barangay fields with selects**

In the address grid, replace the current Barangay and City `<Field>`/`<Input>` blocks (lines ~94-99) with:
```tsx
          <Field label="City" htmlFor="city">
            <Select id="city" value={cityChoice} onChange={(e) => onCityChange(e.target.value)}>
              {cityNames().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER}>Other…</option>
            </Select>
            {cityChoice === OTHER && (
              <Input
                className="mt-2"
                aria-label="City name"
                required
                placeholder="City"
                value={f.city}
                onChange={(e) => set("city", e.target.value)}
              />
            )}
          </Field>
          <Field label="Barangay" htmlFor="brgy">
            <Select id="brgy" value={brgyChoice} onChange={(e) => onBarangayChange(e.target.value)}>
              <option value="">Select barangay…</option>
              {barangaysForCity(f.city).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
              <option value={OTHER}>Other…</option>
            </Select>
            {brgyChoice === OTHER && (
              <Input
                className="mt-2"
                aria-label="Barangay name"
                placeholder="Barangay"
                value={f.barangay ?? ""}
                onChange={(e) => set("barangay", e.target.value)}
              />
            )}
          </Field>
```

(Keep the surrounding `Address` and `Contact number` fields as they are.)

- [ ] **Step 5: Add the optional Google Maps link field**

Immediately after the `Website (optional)` `<Field>` (around line 104-106), add:
```tsx
        <Field label="Google Maps link (optional)" htmlFor="mapUrl" hint="Paste your venue's Google Maps share link.">
          <Input
            id="mapUrl"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            value={f.mapUrl ?? ""}
            onChange={(e) => set("mapUrl", e.target.value)}
          />
        </Field>
```

(If `Field` has no `hint` prop in this codebase, drop the `hint` attribute — it is optional polish.)

- [ ] **Step 6: Send `mapUrl` in the PATCH payload**

In `save()`, add `mapUrl` to the `sendJson` body object (alongside `city`, `barangay`):
```ts
        mapUrl: f.mapUrl,
```

- [ ] **Step 7: Typecheck, lint, build, full suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Manual verification**

With the app running: (a) a new/draft venue shows City preset to "Davao City" with the Davao barangay list; (b) picking "Other" for City reveals a text box and switches Barangay to free entry; (c) switching City from Davao→Tagum resets Barangay and shows Tagum's list (incl. "Magugpo West"); (d) editing the existing `PickleView` (Tagum City / Magugpo West) preselects both; editing a venue whose barangay is off-list (e.g. seed "Ace Pickle Matina" → "Matina") shows Barangay = "Other" with the value prefilled; (e) saving persists city/barangay as typed values (never the literal "Other").

- [ ] **Step 9: Commit**

```bash
git add src/components/venue-admin/DetailsForm.tsx "src/app/(owner)/owner/venues/[id]/details/page.tsx"
git commit -m "feat(venue): cascading city/barangay selects + Google Maps link field"
```

---

## Task 6: "View on Google Maps" link on the public venue page

**Files:**
- Modify: `src/app/(site)/venues/[slug]/page.tsx`

**Interfaces:**
- Consumes: `venueMapUrl` (Task 3), `Venue.mapUrl` (Task 1). The page's `loadVenue` uses `include` (no `select`), so `venue.mapUrl` and `name/addressLine/barangay/city` are all present.

*No automated test — server-rendered UI. Verified by typecheck/lint/build + manual.*

- [ ] **Step 1: Import the helper**

At the top of `src/app/(site)/venues/[slug]/page.tsx`, add:
```ts
import { venueMapUrl } from "@/lib/location/maps";
```

- [ ] **Step 2: Add the link inside the Location section**

In the Location `<section>` (lines 279-287), after the address `<p>` (closes at line 286) and before `</section>`, add:
```tsx
        <a
          href={venueMapUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          <MapPin className="size-4" aria-hidden /> View on Google Maps
        </a>
```

(`MapPin` is already imported at line 4. Use `venueMapUrl(venue)` — never `venue.mapUrl` directly.)

- [ ] **Step 3: Typecheck, lint, build, full suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Manual verification**

With the app running: on a published venue with no owner link, the link points at `google.com/maps/search/?api=1&query=…` (the venue's name + address). After an owner saves a valid `maps.app.goo.gl` link (Task 5), the link uses exactly that URL. The link opens in a new tab.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/venues/[slug]/page.tsx"
git commit -m "feat(venue): View on Google Maps link on the public venue page"
```

---

## Self-Review

**Spec coverage:**
- Migration `Venue.mapUrl` → Task 1. ✔
- Curated `ph-locations.ts` + `OTHER` + helpers → Task 2 (real barangay data embedded). ✔
- `maps.ts` `isValidMapUrl`/`venueMapUrl` + node-testable structural type → Task 3; `normalizeMapUrlInput` added so the route's logic is unit-tested despite routes not being HTTP-tested. ✔
- PATCH dedicated validated branch + `"Other"` reject → Task 4. ✔
- No completeness/publish gating change → Task 4 gating regression test. ✔
- Cascading selects + prefill + city-change-resets-barangay + never-persist-"Other" + maps-link field + round-trip wiring → Task 5. ✔
- Public "View on Google Maps" link via `venueMapUrl`, `rel="noopener noreferrer"`, unconditional → Task 6. ✔
- Security invariant (render `venueMapUrl(venue)`, re-validate stored value, https-only exact-host allowlist) → Task 3 tests + Task 6 usage + Global Constraints. ✔
- Canonical exact city strings → Task 2 test. ✔

**Placeholder scan:** No TBD/TODO; every code and test step has concrete content; barangay lists are fully enumerated. ✔

**Type consistency:** `VenueLocation`, `isValidMapUrl`, `venueMapUrl`, `normalizeMapUrlInput`, `cityNames`, `barangaysForCity`, `OTHER` names match across Tasks 2-6. `mapUrl` typed `string | null` end to end. ✔

**Out of scope (unchanged from spec):** barangay search filter, embedded map, pin-drop, lat/lng parsing, full PSGC dataset, JSON-LD `hasMap`, client-side URL validation.
