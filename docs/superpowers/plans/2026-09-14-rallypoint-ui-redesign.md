# RallyPoint UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure RallyPoint's presentation layer into a modern, premium, mobile-first venue-booking platform — venue hero + URL-driven tabs, time×court schedule grid, design-system primitives, and an owner/admin sidebar shell — without touching any API, data, or business logic.

**Architecture:** Seven sequential phases, each committing verified (typecheck + lint + full test suite + `next build`) changes to `build/venue-location`. New components are purely presentational; all state management, API calls, data fetching, and routing logic stays exactly as today. New stateful client components (ScheduleGrid, MobileCourtPicker, OwnerMobileNav More-sheet) get component-level Vitest tests.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS-first `@theme`), `next/font/google` (Inter), lucide-react, Radix UI, Vitest + @testing-library/react.

## Global Constraints

- **No API changes:** zero modifications to any `/api` route, request/response payload, or DTO shape (`SlotDTO`, `CourtDTO`, `PaymentMethodDTO`, etc.).
- **No schema/migration changes:** Prisma schema and DB stay identical.
- **searchParams-driven server rendering:** `?date`, `?duration`, `?venue`, `?tab` and calendar params all use `<Link scroll={false}>` navigation that re-runs the server component — never replace with client-side state.
- **`Amenities` stays prop-compatible:** `Amenities({ amenities: string[] })` signature unchanged; admin dossier reuses it.
- **Z-order/offset choreography (exact values):** site `BottomTabBar` z-40, booking `Continue` summary z-30 `bottom-16` (md: `bottom-0`), page `pb-24 md:pb-12`, dev FAB z-20, QR panel z-[90].
- **Booking status colors:** keep HELD/PENDING_PAYMENT amber, PAYMENT_SUBMITTED sky, CONFIRMED/COMPLETED brand, EXPIRED/CANCELLED slate, REJECTED red.
- **Tests must stay green (42 files / 180 tests)** and `next build` must pass before moving to next phase.
- **No invented features:** no events UI, no fake data, no nav items for nonexistent pages.
- **cn() path:** `@/lib/cn` (not `@/lib/utils`).

---

## Phase 1 — Design System Foundation

### Task 1: Inter font

**Files:**
- Modify: `src/app/layout.tsx`
- (No test — the font change is visual; typecheck + build confirm it.)

**Interfaces:**
- Produces: `Inter` CSS variable `--font-inter` applied to `<html>` via `className`.

- [ ] **Step 1: Install next/font (already in next package)**

  `next/font` is a sub-module of the `next` package already installed. No install needed.

- [ ] **Step 2: Update root layout**

  ```tsx
  // src/app/layout.tsx
  import type { Metadata } from "next";
  import { Inter } from "next/font/google";
  import "./globals.css";
  import { ToastProvider } from "@/components/ui/toast";
  import { MagicLinkBanner } from "@/components/dev/MagicLinkBanner";
  import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";

  const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
  });

  export const metadata: Metadata = {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: {
      default: "RallyPoint — Find your next game",
      template: "%s · RallyPoint",
    },
    description:
      "Discover and reserve pickleball courts across independent venues in Davao. Search, compare, book, and play.",
    openGraph: {
      type: "website",
      siteName: "RallyPoint",
      title: "RallyPoint — Find your next game",
      description:
        "Discover and reserve pickleball courts across independent venues in Davao.",
    },
  };

  export default function RootLayout({
    children,
  }: Readonly<{ children: React.ReactNode }>) {
    return (
      <html lang="en" className={inter.variable}>
        <body className="bg-white font-[var(--font-inter)] text-ink antialiased">
          <ToastProvider>{children}</ToastProvider>
          <MagicLinkBanner />
          <ShareToPhonePanel />
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 3: Remove the dead font-feature-settings from globals.css** (they're Inter-specific and now apply via next/font)

  In `src/app/globals.css`, remove `font-feature-settings: "cv02", "cv03", "cv04", "cv11";` from the `body` rule. Inter via `next/font` includes these automatically.

- [ ] **Step 4: Verify**

  ```bash
  npm run typecheck && npm run build
  ```

  Expected: both pass, no errors about font.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/layout.tsx src/app/globals.css
  git commit -m "feat(design): load Inter via next/font — activates cv02/cv03/cv04/cv11 features"
  ```

---

### Task 2: New UI primitives — Tabs, SectionHeader, StatCard, Legend

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/section-header.tsx`
- Create: `src/components/ui/stat-card.tsx`
- Create: `src/components/ui/legend.tsx`
- Create: `tests/ui/tabs.test.tsx`
- Create: `tests/ui/stat-card.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // tabs.tsx
  interface TabItem { label: string; value: string; href: string }
  function Tabs(props: { tabs: TabItem[]; activeValue: string; className?: string }): JSX.Element

  // section-header.tsx
  function SectionHeader(props: { children: React.ReactNode; className?: string }): JSX.Element

  // stat-card.tsx
  function StatCard(props: { icon: React.ReactNode; label: string; value: string; urgent?: boolean }): JSX.Element

  // legend.tsx
  interface LegendItem { dotClass: string; label: string }
  function Legend(props: { items: LegendItem[]; className?: string }): JSX.Element
  ```

- [ ] **Step 1: Write failing tests**

  ```tsx
  // tests/ui/tabs.test.tsx
  import { render, screen } from "@testing-library/react";
  import { Tabs } from "@/components/ui/tabs";

  const tabs = [
    { label: "Home", value: "home", href: "/venues/x?tab=home" },
    { label: "Book", value: "book", href: "/venues/x?tab=book" },
    { label: "Reviews", value: "reviews", href: "/venues/x?tab=reviews" },
  ];

  describe("Tabs", () => {
    it("renders all tab labels", () => {
      render(<Tabs tabs={tabs} activeValue="home" />);
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Book")).toBeInTheDocument();
      expect(screen.getByText("Reviews")).toBeInTheDocument();
    });

    it("applies active styling only to the active tab", () => {
      render(<Tabs tabs={tabs} activeValue="book" />);
      const book = screen.getByText("Book").closest("a")!;
      expect(book).toHaveClass("border-brand-600");
      const home = screen.getByText("Home").closest("a")!;
      expect(home).not.toHaveClass("border-brand-600");
    });

    it("renders tabs as links with correct hrefs", () => {
      render(<Tabs tabs={tabs} activeValue="home" />);
      expect(screen.getByText("Book").closest("a")).toHaveAttribute(
        "href",
        "/venues/x?tab=book"
      );
    });
  });
  ```

  ```tsx
  // tests/ui/stat-card.test.tsx
  import { render, screen } from "@testing-library/react";
  import { StatCard } from "@/components/ui/stat-card";
  import { CalendarDays } from "lucide-react";

  describe("StatCard", () => {
    it("renders label and value", () => {
      render(<StatCard icon={<CalendarDays />} label="Today" value="5" />);
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("applies urgent amber styles when urgent is true", () => {
      const { container } = render(
        <StatCard icon={<CalendarDays />} label="Pending" value="3" urgent />
      );
      expect(container.firstChild).toHaveClass("border-amber-200");
    });

    it("does not apply urgent styles by default", () => {
      const { container } = render(
        <StatCard icon={<CalendarDays />} label="Courts" value="2" />
      );
      expect(container.firstChild).not.toHaveClass("border-amber-200");
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npx vitest run tests/ui/tabs.test.tsx tests/ui/stat-card.test.tsx
  ```

  Expected: FAIL — modules not found.

- [ ] **Step 3: Create Tabs component**

  ```tsx
  // src/components/ui/tabs.tsx
  import Link from "next/link";
  import { cn } from "@/lib/cn";

  export interface TabItem {
    label: string;
    value: string;
    href: string;
  }

  export function Tabs({
    tabs,
    activeValue,
    className,
  }: {
    tabs: TabItem[];
    activeValue: string;
    className?: string;
  }) {
    return (
      <nav
        className={cn(
          "flex overflow-x-auto border-b border-black/5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        aria-label="Page sections"
      >
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.href}
            scroll={false}
            aria-current={t.value === activeValue ? "page" : undefined}
            className={cn(
              "shrink-0 px-4 py-3 text-sm font-semibold transition-colors",
              t.value === activeValue
                ? "border-b-2 border-brand-600 text-ink"
                : "text-muted hover:text-ink-soft",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    );
  }
  ```

- [ ] **Step 4: Create SectionHeader**

  ```tsx
  // src/components/ui/section-header.tsx
  import { cn } from "@/lib/cn";

  export function SectionHeader({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <h2
        className={cn(
          "text-sm font-semibold uppercase tracking-wide text-muted",
          className,
        )}
      >
        {children}
      </h2>
    );
  }
  ```

- [ ] **Step 5: Create StatCard**

  ```tsx
  // src/components/ui/stat-card.tsx
  import { cn } from "@/lib/cn";

  export function StatCard({
    icon,
    label,
    value,
    urgent,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    urgent?: boolean;
  }) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-black/5 bg-white p-4 shadow-[var(--shadow-card)]",
          urgent && "border-amber-200 bg-amber-50",
        )}
      >
        <div className="flex items-center gap-2 text-muted">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p
          className={cn(
            "mt-1.5 text-2xl font-extrabold",
            urgent ? "text-amber-800" : "text-ink",
          )}
        >
          {value}
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 6: Create Legend**

  ```tsx
  // src/components/ui/legend.tsx
  import { cn } from "@/lib/cn";

  export interface LegendItem {
    /** Tailwind bg-* class for the color dot, e.g. "bg-brand-500". */
    dotClass: string;
    label: string;
  }

  export function Legend({
    items,
    className,
  }: {
    items: LegendItem[];
    className?: string;
  }) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              className={cn("size-2.5 rounded-sm", item.dotClass)}
              aria-hidden
            />
            {item.label}
          </div>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 7: Run tests to confirm they pass**

  ```bash
  npx vitest run tests/ui/tabs.test.tsx tests/ui/stat-card.test.tsx
  ```

  Expected: PASS — 6 tests.

- [ ] **Step 8: Verify full suite**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Expected: all green.

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/ui/tabs.tsx src/components/ui/section-header.tsx \
    src/components/ui/stat-card.tsx src/components/ui/legend.tsx \
    tests/ui/tabs.test.tsx tests/ui/stat-card.test.tsx
  git commit -m "feat(design): Tabs, SectionHeader, StatCard, Legend primitives"
  ```

---

### Task 3: Card adoption — unify the 11 hand-rolled card divs

The `Card` component (`rounded-2xl border border-black/5 bg-white shadow-[var(--shadow-card)]`) is already correct; these files hand-roll the same pattern without importing it. Replace each hand-rolled div with `<Card>`.

**Files to modify (remove hand-rolled pattern, import and use Card):**

1. `src/app/(site)/login/page.tsx` — already uses Card; confirm shadow present
2. `src/app/(site)/bookings/page.tsx` — `BookingRow` li `rounded-2xl border border-black/5 bg-white p-4`
3. `src/app/(site)/bookings/[reference]/page.tsx` — multiple hand-rolled card sections
4. `src/app/(site)/book/[reference]/page.tsx` — payment/summary card divs
5. `src/app/(site)/venues/[slug]/page.tsx` — review cards (`rounded-2xl border border-black/5 p-4`)
6. `src/app/(owner)/owner/page.tsx` — dashboard Stat component + pending/upcoming rows
7. `src/app/(owner)/owner/reservations/page.tsx` — reservation rows
8. `src/components/booking/BookingSummary.tsx` — outer card div
9. `src/components/booking/PaymentStep.tsx` — info box and payment method radio cards
10. `src/components/venue/VenueCard.tsx` — outer card (already has shadow, just import Card)
11. `src/components/search/SearchBar.tsx` — form card

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card` — same props as a `div`
- No behavior change — purely visual substitution

**Strategy for each file:** find `rounded-2xl border border-black/5 bg-white` divs → wrap in `<Card className="...rest-of-classes">` keeping all non-card classes (padding, spacing, etc.) as `className`.

- [ ] **Step 1: Update bookings/page.tsx BookingRow**

  In `src/app/(site)/bookings/page.tsx`, import `Card` and change `BookingRow`:

  ```tsx
  import { Card } from "@/components/ui/card";
  // ...
  function BookingRow({ b, resumable }: { b: Row; resumable?: boolean }) {
    // ...
    return (
      <li>
        <Card className="p-4">
          {/* ...same content... */}
        </Card>
      </li>
    );
  }
  ```

- [ ] **Step 2: Update bookings/[reference]/page.tsx**

  Import `Card` and replace each `rounded-2xl border border-black/5 bg-white` div with `<Card className="p-4">` or `<Card className="p-5">` as appropriate. Do NOT change the content or data.

- [ ] **Step 3: Update book/[reference]/page.tsx**

  Same pattern — replace hand-rolled card wrappers with `<Card>`.

- [ ] **Step 4: Update venues/[slug]/page.tsx review cards**

  Change the review `<li className="rounded-2xl border border-black/5 p-4">` to:
  ```tsx
  <li key={r.id}>
    <Card className="p-4">
      {/* ...same content... */}
    </Card>
  </li>
  ```

- [ ] **Step 5: Update owner/page.tsx Stat + row items**

  Replace the inline `Stat` component's div with `<Card className="p-4">`. Replace the `pending/upcoming` row `<li>` card divs with `<Card className="flex items-center ... p-3">`.

- [ ] **Step 6: Update owner/reservations/page.tsx**

  Same pattern — reservation row cards.

- [ ] **Step 7: Update BookingSummary.tsx, PaymentStep.tsx, VenueCard.tsx, SearchBar.tsx**

  In each, import `Card` and replace the outer card div. Keep all `className` additions.

  For `PaymentStep.tsx` — the payment-method radio cards get:
  ```tsx
  <Card
    className={cn(
      "cursor-pointer p-3.5 transition",
      selected === pm.id
        ? "border-brand-600 bg-brand-50"
        : "hover:border-black/10",
    )}
  >
  ```
  Note: override the default `border-black/5` via className. The `cn` + tailwind-merge will keep the explicit `border-brand-600` when selected.

- [ ] **Step 8: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Expected: all green. Visual change only.

- [ ] **Step 9: Commit**

  ```bash
  git add src/app src/components
  git commit -m "refactor(design): adopt Card primitive across all 11 hand-rolled card divs"
  ```

---

### Task 4: Radius normalization — replace stray `rounded-md`

Replace `rounded-md` with the appropriate tier in four files. No behavior changes.

**Files:**
- Modify: `src/components/dev/MagicLinkBanner.tsx` → `rounded-xl`
- Modify: `src/components/venue-admin/PhotoManager.tsx` → `rounded-xl`
- Modify: `src/components/venue-admin/PaymentMethodEditor.tsx` → `rounded-xl`
- Modify: `src/components/venue-admin/CourtEditor.tsx` → `rounded-xl`

- [ ] **Step 1: Fix MagicLinkBanner**

  Open `src/components/dev/MagicLinkBanner.tsx`. Change every `rounded-md` to `rounded-xl`.

- [ ] **Step 2: Fix PhotoManager, PaymentMethodEditor, CourtEditor**

  In each file, do the same replacement. Keep everything else identical.

- [ ] **Step 3: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/dev/MagicLinkBanner.tsx \
    src/components/venue-admin/PhotoManager.tsx \
    src/components/venue-admin/PaymentMethodEditor.tsx \
    src/components/venue-admin/CourtEditor.tsx
  git commit -m "refactor(design): normalize stray rounded-md to rounded-xl"
  ```

---

## Phase 2 — Venue Page: Hero + Tabs

### Task 5: Venue page — tab routing, hero block, and updated DateRail hrefs

**Files:**
- Modify: `src/app/(site)/venues/[slug]/page.tsx`
- Modify: `src/components/court/DateRail.tsx`

**Interfaces:**
- `DateRail` gains optional `tab?: string` prop; when present appends `&tab=book` to all chip hrefs.
- VenuePage `searchParams` expands to `{ date?: string; duration?: string; tab?: string }`.
- Active tab resolution: `const tab = sp.tab ?? (sp.date || sp.duration ? "book" : "home")`.

- [ ] **Step 1: Update DateRail to accept and include `tab` prop**

  In `src/components/court/DateRail.tsx`:

  ```tsx
  export function DateRail({
    days,
    slug,
    dateStr,
    duration,
    tab,
  }: {
    days: DayChip[];
    slug: string;
    dateStr: string;
    duration: string;
    tab?: string;
  }) {
    // ... existing state/refs unchanged ...
    return (
      <div ref={scrollRef} className="...existing classes...">
        {days.map((d) => {
          const active = d.iso === dateStr;
          const href = `/venues/${slug}?date=${d.iso}&duration=${duration}${tab ? `&tab=${tab}` : ""}`;
          return (
            <Link
              key={d.iso}
              ref={active ? activeRef : undefined}
              href={href}
              scroll={false}
              // ...rest unchanged...
            >
              {/* ...unchanged content... */}
            </Link>
          );
        })}
      </div>
    );
  }
  ```

- [ ] **Step 2: Restructure the venue page to add tab routing and hero block**

  Replace the current `VenuePage` return JSX. The data-loading, `loadVenue()`, `isLive()`, availability computation, `hoursByDay`, `dayChips`, `selectedDateLabel` — all stay identical. Only the JSX output changes.

  ```tsx
  export default async function VenuePage({
    params,
    searchParams,
  }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ date?: string; duration?: string; tab?: string }>;
  }) {
    // ... existing data loading unchanged ...

    // Tab resolution: if date/duration present without tab, default to book.
    const tab = sp.tab ?? (sp.date || sp.duration ? "book" : "home");

    // Min price for the hero block — same logic VenueCard uses.
    const minPriceCents = venue.courts.reduce<number | null>(
      (min, c) => (min === null ? c.priceCents : Math.min(min, c.priceCents)),
      null,
    );

    const venueTabs = [
      {
        label: "Home",
        value: "home",
        href: `/venues/${venue.slug}?tab=home`,
      },
      {
        label: "Book",
        value: "book",
        href: `/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`,
      },
      {
        label: "Reviews",
        value: "reviews",
        href: `/venues/${venue.slug}?tab=reviews`,
      },
    ];

    return (
      <div className="mx-auto max-w-5xl pb-24 md:pb-12">
        {/* Preview banner — unchanged, full-width above gallery */}
        {!live && (
          <div className="mx-5 mt-4 mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
            Preview — this venue isn&apos;t live yet. Only you and admins can see this page.
          </div>
        )}
        {live && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(venueJsonLd(venue)) }}
          />
        )}

        {/* Gallery — full-bleed mobile, contained sm+ (unchanged from committed pass) */}
        <div className="-mx-0 sm:mx-0 sm:mt-6">
          <Gallery photos={venue.photos} name={venue.name} />
        </div>

        {/* Hero title block */}
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                  {venue.name}
                </h1>
                <Badge tone="brand" className="gap-1 px-2 py-0.5 text-[11px]">
                  <ShieldCheck className="size-3" aria-hidden /> Verified
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1 text-ink-soft">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                  <span className="font-semibold text-ink">
                    {ratingSummary.avg.toFixed(1)}
                  </span>
                  <span>({ratingSummary.count} reviews)</span>
                </span>
                {minPriceCents !== null && (
                  <span className="font-medium text-ink-soft">
                    From <span className="text-ink">{pesos(minPriceCents)}</span>/hr
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {venue.barangay ? `${venue.barangay}, ` : ""}
                  {venue.city}
                </span>
              </div>
            </div>
            <Link
              href={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`}
              className="shrink-0"
            >
              <Button size="sm">Book a court</Button>
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-5 px-5">
          <Tabs tabs={venueTabs} activeValue={tab} />
        </div>

        {/* Tab content */}
        <div className="px-5">
          {tab === "home" && (
            <HomeTab venue={venue} hoursByDay={hoursByDay} />
          )}
          {tab === "book" && (
            <BookTab
              venue={venue}
              courts={courts}
              durationMinutes={durationMinutes}
              duration={duration}
              dateStr={dateStr}
              dayChips={dayChips}
              selectedDateLabel={selectedDateLabel}
              isAuthed={!!session}
            />
          )}
          {tab === "reviews" && (
            <ReviewsTab ratingSummary={ratingSummary} recentReviews={recentReviews} />
          )}
        </div>
      </div>
    );
  }
  ```

  These sub-components (`HomeTab`, `BookTab`, `ReviewsTab`) are private to the file (not exported), defined in the same file below the main component:

  ```tsx
  // HomeTab — renders About, Amenities, Hours, Contact, Location, House rules
  function HomeTab({
    venue,
    hoursByDay,
  }: {
    venue: { description: string | null; amenities: string[]; houseRules: string | null; addressLine: string | null; barangay: string | null; city: string; contactNumber: string | null; website: string | null; mapUrl: string | null; lat: number | null; lng: number | null };
    hoursByDay: Map<number, { open: number; close: number }>;
  }) {
    const mapUrl = venueMapUrl(venue as Parameters<typeof venueMapUrl>[0]);
    return (
      <div className="space-y-8 py-6">
        {venue.description && (
          <section>
            <h2 className="text-lg font-bold text-ink">About</h2>
            <p className="mt-2 text-ink-soft">{venue.description}</p>
          </section>
        )}
        {venue.amenities.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-ink">Amenities</h2>
            <div className="mt-3">
              <Amenities amenities={venue.amenities} />
            </div>
          </section>
        )}
        {hoursByDay.size > 0 && (
          <section>
            <h2 className="text-lg font-bold text-ink">Operating hours</h2>
            <ul className="mt-3 max-w-sm space-y-1 text-sm">
              {WEEKDAY_ORDER.map((wd) => {
                const h = hoursByDay.get(wd);
                const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                return (
                  <li key={wd} className="flex justify-between">
                    <span className="text-ink-soft">{names[wd]}</span>
                    <span className="text-muted">
                      {h ? `${minuteLabel(h.open)} – ${minuteLabel(h.close)}` : "Closed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {(venue.contactNumber || venue.website) && (
          <section>
            <h2 className="text-lg font-bold text-ink">Contact</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {venue.contactNumber && (
                <li>
                  <a href={`tel:${venue.contactNumber}`} className="hover:text-brand-700">
                    {venue.contactNumber}
                  </a>
                </li>
              )}
              {venue.website && (
                <li>
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-700"
                  >
                    {venue.website}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}
        <section>
          <h2 className="text-lg font-bold text-ink">Location</h2>
          <p className="mt-2 text-ink-soft">
            {venue.addressLine ? `${venue.addressLine}, ` : ""}
            {venue.barangay ? `${venue.barangay}, ` : ""}
            {venue.city}
          </p>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            <MapPin className="size-4" aria-hidden /> View on Google Maps
          </a>
        </section>
        {venue.houseRules && (
          <section>
            <h2 className="text-lg font-bold text-ink">House rules</h2>
            <p className="mt-2 whitespace-pre-line text-ink-soft">{venue.houseRules}</p>
          </section>
        )}
      </div>
    );
  }

  // BookTab — date rail, duration chips, court booking (unchanged logic)
  function BookTab({
    venue,
    courts,
    durationMinutes,
    duration,
    dateStr,
    dayChips,
    selectedDateLabel,
    isAuthed,
  }: {
    venue: { slug: string };
    courts: CourtDTO[];
    durationMinutes: number;
    duration: string;
    dateStr: string;
    dayChips: DayChip[];
    selectedDateLabel: string;
    isAuthed: boolean;
  }) {
    return (
      <div className="py-6">
        <div className="-mx-5">
          <DateRail
            days={dayChips}
            slug={venue.slug}
            dateStr={dateStr}
            duration={duration}
            tab="book"
          />
        </div>
        <div className="mt-3 flex gap-2">
          {DURATIONS.map((dur) => {
            const active = dur.value === duration;
            return (
              <Link
                key={dur.value}
                href={`/venues/${venue.slug}?date=${dateStr}&duration=${dur.value}&tab=book`}
                scroll={false}
                className={cn(
                  "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-black/10 bg-white text-ink-soft hover:bg-black/5",
                )}
              >
                {dur.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-sm font-medium text-ink-soft">{longDateLabel(parseIsoDate(dateStr))}</p>
        <div className="mt-3">
          <CourtBooking
            courts={courts}
            durationMinutes={durationMinutes}
            isAuthed={isAuthed}
            returnTo={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`}
            selectedDateLabel={selectedDateLabel}
          />
        </div>
      </div>
    );
  }

  // ReviewsTab — existing rating + distribution bars + review cards
  function ReviewsTab({
    ratingSummary,
    recentReviews,
  }: {
    ratingSummary: { avg: number; count: number; distribution: Record<1|2|3|4|5, number> };
    recentReviews: Array<{ id: string; rating: number; authorName: string; createdAt: Date; body: string | null }>;
  }) {
    if (ratingSummary.count === 0) {
      return <p className="py-8 text-muted">No reviews yet.</p>;
    }
    return (
      <div className="py-6">
        {/* ...existing reviews JSX from current page, moved here verbatim... */}
      </div>
    );
  }
  ```

  Add the necessary imports at the top of the file:
  ```tsx
  import { Tabs } from "@/components/ui/tabs";
  import { Button } from "@/components/ui/button";
  import type { DayChip } from "@/components/court/DateRail";
  ```

  Remove imports that are no longer at top level but are used in sub-components (they should stay as imports since sub-components are in the same file).

- [ ] **Step 3: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Expected: all green. Test: manually start `npm run dev`, open `/venues/[slug]` — verify Home, Book, Reviews tabs switch content without page reload; `?date=` links land on Book tab.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/"(site)"/venues/"[slug]"/page.tsx src/components/court/DateRail.tsx
  git commit -m "feat(venue): hero block + Home|Book|Reviews URL-driven tabs, contact surfaced"
  ```

---

## Phase 3 — Booking Schedule Grid + Mobile Picker

### Task 6: ScheduleGrid — desktop time × court grid

**Files:**
- Create: `src/components/court/ScheduleGrid.tsx`
- Create: `tests/court/schedule-grid.test.tsx`

**Interfaces:**
- Consumes: `CourtDTO`, `SlotDTO` from `@/components/court/CourtBooking`
  ```ts
  type Selection = { courtId: string; startsAt: string };
  ```
- Produces:
  ```ts
  function ScheduleGrid(props: {
    courts: CourtDTO[];
    selected: Selection | null;
    onSelect: (court: CourtDTO, slot: SlotDTO) => void;
  }): JSX.Element
  ```
- Time bands: Morning = hour < 12, Afternoon = 12 ≤ hour < 17, Evening = hour ≥ 17.

- [ ] **Step 1: Write failing tests**

  ```tsx
  // tests/court/schedule-grid.test.tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { ScheduleGrid } from "@/components/court/ScheduleGrid";
  import type { CourtDTO } from "@/components/court/CourtBooking";

  function makeSlot(hour: number, available = true) {
    const d = new Date("2026-09-15T00:00:00Z");
    d.setUTCHours(hour);
    return { startsAt: d.toISOString(), available, priceCents: 30000 };
  }

  const courts: CourtDTO[] = [
    {
      id: "c1",
      name: "Court 1",
      indoor: true,
      covered: true,
      surface: "Hardcourt",
      priceCents: 30000,
      slots: [makeSlot(8), makeSlot(9, false), makeSlot(13)],
    },
    {
      id: "c2",
      name: "Court 2",
      indoor: false,
      covered: false,
      surface: null,
      priceCents: 25000,
      slots: [makeSlot(8), makeSlot(18)],
    },
  ];

  describe("ScheduleGrid", () => {
    it("renders court column headers", () => {
      render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
      expect(screen.getByText("Court 1")).toBeInTheDocument();
      expect(screen.getByText("Court 2")).toBeInTheDocument();
    });

    it("renders band labels", () => {
      render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
      expect(screen.getByText("Morning")).toBeInTheDocument();
      expect(screen.getByText("Afternoon")).toBeInTheDocument();
      expect(screen.getByText("Evening")).toBeInTheDocument();
    });

    it("calls onSelect with correct court and slot when available cell clicked", () => {
      const onSelect = vi.fn();
      render(<ScheduleGrid courts={courts} selected={null} onSelect={onSelect} />);
      // The 8:00 AM slot for Court 1 should be clickable
      const buttons = screen.getAllByRole("button");
      const available = buttons.find((b) => !b.hasAttribute("disabled") && b.textContent?.includes("8:00"));
      expect(available).toBeDefined();
      fireEvent.click(available!);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c1" }),
        expect.objectContaining({ available: true })
      );
    });

    it("disables unavailable slots", () => {
      render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
      const buttons = screen.getAllByRole("button");
      const disabled = buttons.filter((b) => b.hasAttribute("disabled"));
      expect(disabled.length).toBeGreaterThan(0);
    });

    it("applies selected style to the selected slot", () => {
      const sel = { courtId: "c1", startsAt: courts[0].slots[0].startsAt, courtName: "Court 1", priceCents: 30000 };
      render(<ScheduleGrid courts={courts} selected={sel} onSelect={() => {}} />);
      const buttons = screen.getAllByRole("button");
      const selBtn = buttons.find((b) => b.getAttribute("aria-pressed") === "true");
      expect(selBtn).toBeDefined();
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  npx vitest run tests/court/schedule-grid.test.tsx
  ```

  Expected: FAIL — module not found.

- [ ] **Step 3: Implement ScheduleGrid**

  ```tsx
  // src/components/court/ScheduleGrid.tsx
  "use client";

  import { cn } from "@/lib/cn";
  import { pesos, timeLabel } from "@/lib/format";
  import type { CourtDTO, SlotDTO } from "@/components/court/CourtBooking";

  type Selection = {
    courtId: string;
    startsAt: string;
    courtName: string;
    priceCents: number;
  } | null;

  type Band = { label: string; times: string[] };

  /** Returns a union of all slot start-time ISO strings across all courts, sorted. */
  function allTimes(courts: CourtDTO[]): string[] {
    const set = new Set<string>();
    for (const c of courts) {
      for (const s of c.slots) set.add(s.startsAt);
    }
    return Array.from(set).sort();
  }

  /** Groups sorted ISO time strings into Morning/Afternoon/Evening bands. */
  function toBands(times: string[]): Band[] {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    for (const t of times) {
      const hour = new Date(t).getUTCHours();
      if (hour < 12) morning.push(t);
      else if (hour < 17) afternoon.push(t);
      else evening.push(t);
    }
    return [
      { label: "Morning", times: morning },
      { label: "Afternoon", times: afternoon },
      { label: "Evening", times: evening },
    ].filter((b) => b.times.length > 0);
  }

  export function ScheduleGrid({
    courts,
    selected,
    onSelect,
  }: {
    courts: CourtDTO[];
    selected: Selection;
    onSelect: (court: CourtDTO, slot: SlotDTO) => void;
  }) {
    const times = allTimes(courts);
    const bands = toBands(times);

    // Build a lookup: courtId → Map(startsAt → SlotDTO)
    const slotMap = new Map(
      courts.map((c) => [c.id, new Map(c.slots.map((s) => [s.startsAt, s]))])
    );

    const gridCols = `64px repeat(${courts.length}, minmax(90px, 1fr))`;

    return (
      <div className="overflow-x-auto rounded-2xl border border-black/5">
        {/* Column headers */}
        <div
          className="grid border-b border-black/5 bg-slate-50"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="p-3" /> {/* time column */}
          {courts.map((c) => {
            const closed = c.slots.length === 0;
            const full = !closed && c.slots.every((s) => !s.available);
            return (
              <div
                key={c.id}
                className="border-l border-black/5 p-3 text-center"
              >
                <p className="text-[13px] font-semibold text-ink">{c.name}</p>
                <p className="text-[11px] text-muted">
                  {c.indoor ? "Indoor" : "Outdoor"} · {pesos(c.priceCents)}/hr
                </p>
                {(closed || full) && (
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      closed
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {closed ? "Closed" : "Full"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Band rows */}
        {bands.map((band) => (
          <div key={band.label}>
            {/* Band label row */}
            <div
              className="grid border-b border-black/5 bg-brand-50/40"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div
                className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700"
                style={{ gridColumn: `1 / span ${courts.length + 1}` }}
              >
                {band.label}
              </div>
            </div>
            {/* Time rows */}
            {band.times.map((t) => (
              <div
                key={t}
                className="grid border-b border-black/5 last:border-b-0"
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* Time label */}
                <div className="flex items-center px-3 py-2 text-[12px] text-muted tabular-nums">
                  {timeLabel(new Date(t))}
                </div>
                {/* Court cells */}
                {courts.map((c) => {
                  const slot = slotMap.get(c.id)?.get(t);
                  const isSel =
                    selected?.courtId === c.id && selected?.startsAt === t;
                  return (
                    <div
                      key={c.id}
                      className="border-l border-black/5 p-1.5"
                    >
                      {slot ? (
                        <button
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={isSel}
                          onClick={() => onSelect(c, slot)}
                          className={cn(
                            "h-10 w-full rounded-xl text-[12px] font-medium tabular-nums transition",
                            !slot.available
                              ? "cursor-not-allowed bg-slate-50 text-slate-300 line-through"
                              : isSel
                                ? "bg-brand-600 text-white shadow-sm"
                                : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                          )}
                        >
                          {slot.available ? pesos(slot.priceCents) : "—"}
                        </button>
                      ) : (
                        <div className="h-10 rounded-xl bg-slate-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run tests/court/schedule-grid.test.tsx
  ```

  Expected: PASS — 5 tests.

- [ ] **Step 5: Full verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/court/ScheduleGrid.tsx tests/court/schedule-grid.test.tsx
  git commit -m "feat(venue): ScheduleGrid — desktop time×court booking grid"
  ```

---

### Task 7: MobileCourtPicker — court chips + slotted view for mobile

**Files:**
- Create: `src/components/court/MobileCourtPicker.tsx`
- Create: `tests/court/mobile-court-picker.test.tsx`

**Interfaces:**
- Consumes: `CourtDTO`, `SlotDTO` (same types as ScheduleGrid).
- Produces:
  ```ts
  function MobileCourtPicker(props: {
    courts: CourtDTO[];
    selected: Selection | null;
    onSelect: (court: CourtDTO, slot: SlotDTO) => void;
  }): JSX.Element
  ```
  Internal state: `activeCourt: string` (ID of the court whose slots are displayed). Defaults to the first court with available slots; if none, defaults to `courts[0]?.id`.

- [ ] **Step 1: Write failing tests**

  ```tsx
  // tests/court/mobile-court-picker.test.tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { MobileCourtPicker } from "@/components/court/MobileCourtPicker";
  import type { CourtDTO } from "@/components/court/CourtBooking";

  function makeSlot(hour: number, available = true) {
    const d = new Date("2026-09-15T00:00:00Z");
    d.setUTCHours(hour);
    return { startsAt: d.toISOString(), available, priceCents: 30000 };
  }

  const courts: CourtDTO[] = [
    {
      id: "c1",
      name: "Court A",
      indoor: true,
      covered: false,
      surface: null,
      priceCents: 30000,
      slots: [makeSlot(8), makeSlot(13, false)],
    },
    {
      id: "c2",
      name: "Court B",
      indoor: false,
      covered: false,
      surface: null,
      priceCents: 25000,
      slots: [makeSlot(9)],
    },
  ];

  describe("MobileCourtPicker", () => {
    it("renders court selector chips", () => {
      render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
      expect(screen.getByText("Court A")).toBeInTheDocument();
      expect(screen.getByText("Court B")).toBeInTheDocument();
    });

    it("shows slots for the active court", () => {
      render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
      // Court A is first/default; its 8 AM slot should be visible
      expect(screen.getAllByRole("button").length).toBeGreaterThan(2); // chips + at least 1 slot
    });

    it("switches to Court B slots when its chip is clicked", () => {
      render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
      fireEvent.click(screen.getByText("Court B"));
      // After switching, Court B's 9 AM slot should be visible
      const slotBtns = screen.getAllByRole("button").filter(
        (b) => !["Court A", "Court B"].includes(b.textContent ?? "")
      );
      expect(slotBtns.length).toBeGreaterThan(0);
    });

    it("calls onSelect when an available slot is clicked", () => {
      const onSelect = vi.fn();
      render(<MobileCourtPicker courts={courts} selected={null} onSelect={onSelect} />);
      const slotBtns = screen.getAllByRole("button").filter(
        (b) => !["Court A", "Court B"].includes(b.textContent ?? "") && !b.hasAttribute("disabled")
      );
      fireEvent.click(slotBtns[0]);
      expect(onSelect).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  npx vitest run tests/court/mobile-court-picker.test.tsx
  ```

- [ ] **Step 3: Implement MobileCourtPicker**

  ```tsx
  // src/components/court/MobileCourtPicker.tsx
  "use client";

  import { useState } from "react";
  import { cn } from "@/lib/cn";
  import { timeLabel } from "@/lib/format";
  import type { CourtDTO, SlotDTO } from "@/components/court/CourtBooking";

  type Selection = {
    courtId: string;
    startsAt: string;
    courtName: string;
    priceCents: number;
  } | null;

  type Band = { label: string; slots: SlotDTO[] };

  function toBands(slots: SlotDTO[]): Band[] {
    const morning: SlotDTO[] = [];
    const afternoon: SlotDTO[] = [];
    const evening: SlotDTO[] = [];
    for (const s of slots) {
      const hour = new Date(s.startsAt).getUTCHours();
      if (hour < 12) morning.push(s);
      else if (hour < 17) afternoon.push(s);
      else evening.push(s);
    }
    return [
      { label: "Morning", slots: morning },
      { label: "Afternoon", slots: afternoon },
      { label: "Evening", slots: evening },
    ].filter((b) => b.slots.length > 0);
  }

  export function MobileCourtPicker({
    courts,
    selected,
    onSelect,
  }: {
    courts: CourtDTO[];
    selected: Selection;
    onSelect: (court: CourtDTO, slot: SlotDTO) => void;
  }) {
    const defaultCourt =
      courts.find((c) => c.slots.some((s) => s.available)) ?? courts[0];
    const [activeId, setActiveId] = useState<string>(defaultCourt?.id ?? "");

    const activeCourt = courts.find((c) => c.id === activeId) ?? courts[0];
    const bands = activeCourt ? toBands(activeCourt.slots) : [];

    return (
      <div className="space-y-4">
        {/* Court selector chips */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {courts.map((c) => {
            const closed = c.slots.length === 0;
            const full = !closed && c.slots.every((s) => !s.available);
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-black/10 bg-white text-ink-soft hover:bg-black/5",
                )}
              >
                {c.name}
                {(closed || full) && (
                  <span
                    className={cn(
                      "ml-1.5 text-[10px]",
                      isActive ? "text-white/70" : "text-muted",
                    )}
                  >
                    {closed ? "Closed" : "Full"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Slot bands */}
        {activeCourt?.slots.length === 0 ? (
          <p className="text-sm text-muted">Closed on this day.</p>
        ) : activeCourt?.slots.every((s) => !s.available) ? (
          <p className="text-sm text-muted">No open times for this date.</p>
        ) : (
          <div className="space-y-4">
            {bands.map((band) => (
              <div key={band.label}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {band.label}
                </p>
                <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
                  {band.slots.map((slot) => {
                    const isSel =
                      selected?.courtId === activeId &&
                      selected?.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={isSel}
                        onClick={() => activeCourt && onSelect(activeCourt, slot)}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-xl text-[13px] font-medium tabular-nums transition",
                          !slot.available
                            ? "cursor-not-allowed bg-slate-100 text-slate-300 line-through"
                            : isSel
                              ? "bg-brand-600 text-white shadow-sm"
                              : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                        )}
                      >
                        {timeLabel(new Date(slot.startsAt))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npx vitest run tests/court/mobile-court-picker.test.tsx
  ```

  Expected: PASS — 4 tests.

- [ ] **Step 5: Full verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/court/MobileCourtPicker.tsx tests/court/mobile-court-picker.test.tsx
  git commit -m "feat(venue): MobileCourtPicker — court chips + banded slot grid for mobile"
  ```

---

### Task 8: CourtBooking — integrate grid/picker + Legend

**Files:**
- Modify: `src/components/court/CourtBooking.tsx`

**Interfaces:**
- Consumes: `ScheduleGrid` from `./ScheduleGrid`, `MobileCourtPicker` from `./MobileCourtPicker`, `Legend` from `@/components/ui/legend`.
- No prop changes; external API of `CourtBooking` stays identical.

- [ ] **Step 1: Update CourtBooking to use ScheduleGrid on md+ and MobileCourtPicker on mobile**

  Replace the per-court card rendering inside `CourtBooking` with the two new components. The `select()` function, `reserve()` logic, sticky summary bar, and all props stay identical.

  ```tsx
  // src/components/court/CourtBooking.tsx
  "use client";

  import { useRef, useState } from "react";
  import { useRouter } from "next/navigation";
  import { Button } from "@/components/ui/button";
  import { Legend } from "@/components/ui/legend";
  import { useToast } from "@/components/ui/toast";
  import { ScheduleGrid } from "@/components/court/ScheduleGrid";
  import { MobileCourtPicker } from "@/components/court/MobileCourtPicker";
  import { pesos, timeLabel } from "@/lib/format";

  // SlotDTO, CourtDTO, Selection type definitions — UNCHANGED
  // select(), reserve() functions — UNCHANGED
  // hours, durationLabel computation — UNCHANGED

  const SLOT_LEGEND = [
    { dotClass: "bg-brand-500", label: "Available" },
    { dotClass: "bg-brand-600", label: "Selected" },
    { dotClass: "bg-slate-200", label: "Unavailable" },
  ];

  return (
    <div className="space-y-4">
      <Legend items={SLOT_LEGEND} />

      {/* Desktop: time × court grid */}
      <div className="hidden md:block">
        <ScheduleGrid courts={courts} selected={selected} onSelect={select} />
      </div>

      {/* Mobile: court chips + banded slots */}
      <div className="md:hidden">
        <MobileCourtPicker courts={courts} selected={selected} onSelect={select} />
      </div>

      {/* Sticky summary bar — UNCHANGED (bottom-16 z-30 md:bottom-0) */}
      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-black/5 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {selected.courtName} · {selectedDateLabel}
              </p>
              <p className="truncate text-xs text-muted">
                {timeLabel(new Date(selected.startsAt))} · {durationLabel}
              </p>
            </div>
            <p className="shrink-0 text-base font-bold text-ink">{pesos(selected.priceCents)}</p>
            <Button onClick={reserve} loading={submitting} size="lg" className="shrink-0">
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
  ```

- [ ] **Step 2: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Expected: all green. Manually check: `/venues/[slug]?tab=book` on ≥768px shows the grid, on <768px shows court chips.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/court/CourtBooking.tsx
  git commit -m "feat(venue): CourtBooking integrates ScheduleGrid (md+) + MobileCourtPicker + Legend"
  ```

---

## Phase 4 — Public Site Polish

### Task 9: Home + Search pages

**Files:**
- Modify: `src/app/(site)/page.tsx`
- Modify: `src/app/(site)/search/page.tsx`
- Modify: `src/components/venue/VenueCard.tsx`
- Modify: `src/components/search/SearchBar.tsx`

The structural logic (data fetching, URL params, server rendering) is completely unchanged. Only typography, spacing, and visual hierarchy improve.

- [ ] **Step 1: Polish home page**

  In `src/app/(site)/page.tsx`, make these targeted changes:

  - Hero: Add `SectionHeader` import (not needed for this page, but make `h2` headings consistent). Change the "Popular venues" section to use a `SectionHeader`:
    ```tsx
    import { SectionHeader } from "@/components/ui/section-header";
    // ...
    <SectionHeader className="text-xl font-bold text-ink">Popular venues</SectionHeader>
    ```
  - "How RallyPoint works" section: keep structure identical, refine step cards to use `Card` component:
    ```tsx
    import { Card } from "@/components/ui/card";
    // ...
    <Card className="p-6 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
        <s.icon className="size-6" aria-hidden />
      </div>
      <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
      <p className="mt-1 text-sm text-muted">{s.body}</p>
    </Card>
    ```

- [ ] **Step 2: Polish search page**

  In `src/app/(site)/search/page.tsx`, replace the hand-rolled page header into a consistent structure. The data-loading and filtering logic stays identical. Use `SectionHeader` for the results count heading.

- [ ] **Step 3: Improve VenueCard typography hierarchy**

  In `src/components/venue/VenueCard.tsx`:
  - Move venue name to be the most visually prominent element:
    ```tsx
    <h3 className="text-[15px] font-bold text-ink">{venue.name}</h3>
    ```
  - Rating row: slightly larger star:
    ```tsx
    <Star className="size-4 fill-amber-400 text-amber-400" />
    ```
  - Price-from: more prominent:
    ```tsx
    <p className="text-sm font-semibold text-ink">
      From {pesos(venue.priceFromCents)}<span className="font-normal text-muted">/hr</span>
    </p>
    ```

- [ ] **Step 4: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/"(site)"/page.tsx src/app/"(site)"/search/page.tsx \
    src/components/venue/VenueCard.tsx src/components/search/SearchBar.tsx
  git commit -m "refactor(public): home + search page polish, VenueCard hierarchy"
  ```

---

### Task 10: Checkout, Bookings, and Booking status pages

**Files:**
- Modify: `src/app/(site)/book/[reference]/page.tsx`
- Modify: `src/app/(site)/bookings/page.tsx`
- Modify: `src/app/(site)/bookings/[reference]/page.tsx`
- Modify: `src/components/booking/BookingSummary.tsx`

Logic, data, and step branching are unchanged. Only visual layout improvements.

- [ ] **Step 1: Polish checkout `/book/[reference]`**

  In `src/app/(site)/book/[reference]/page.tsx`:
  - Wrap each step's content section in `<Card className="p-5">`.
  - Use `SectionHeader` for section labels.
  - The step list (DetailsForm, PaymentStep) and their props stay identical.

- [ ] **Step 2: Polish bookings list `/bookings`**

  In `src/app/(site)/bookings/page.tsx`, the `BookingRow` already uses `Card` from Task 3. Add the `shadow-[var(--shadow-card)]` if missing. Change `Section` heading to use `SectionHeader`:
  ```tsx
  import { SectionHeader } from "@/components/ui/section-header";
  // In Section component:
  <SectionHeader>{title}</SectionHeader>
  ```

- [ ] **Step 3: Polish booking detail `/bookings/[reference]`**

  Use `Card` wrappers and `SectionHeader` throughout. The 5-step progress card, payment section, StatusTimeline, ReviewPrompt — all keep their logic. Just wrap in `<Card className="p-5 space-y-4">` sections.

- [ ] **Step 4: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/"(site)"/book src/app/"(site)"/bookings src/components/booking/BookingSummary.tsx
  git commit -m "refactor(public): checkout + bookings pages — unified Card sections"
  ```

---

### Task 11: SiteHeader, BottomTabBar, Footer, Login, List-your-venue

**Files:**
- Modify: `src/components/nav/SiteHeader.tsx`
- Modify: `src/app/(site)/layout.tsx`
- Modify: `src/app/(site)/login/page.tsx`
- Modify: `src/app/(site)/list-your-venue/page.tsx`

- [ ] **Step 1: SiteHeader — active nav state**

  In `src/components/nav/SiteHeader.tsx`, this is a server component and cannot use `usePathname`. Convert to a client component to add active styling, OR accept `pathname` as a prop from the (site) layout. The layout already passes `session`.

  Cleanest: convert `SiteHeader` to a client component (small — it's 57 lines):

  ```tsx
  "use client";
  import { usePathname } from "next/navigation";
  // ...same content...
  const pathname = usePathname();
  // In nav links:
  const active = n.href === "/" ? pathname === n.href : pathname.startsWith(n.href);
  className={cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-black/5",
  )}
  ```

  The `session` prop is still passed from the layout (server component reads session, passes as prop to this client component — same pattern used elsewhere).

- [ ] **Step 2: Footer — use `SectionHeader` for wordmark, Card wrapper optional**

  In `src/app/(site)/layout.tsx`, update the footer typography:
  ```tsx
  <p className="text-base font-extrabold tracking-tight">
    Rally<span className="text-accent-dark">Point</span>
  </p>
  ```

- [ ] **Step 3: Login + list-your-venue polish**

  Both pages just need `Card` wrappers (login already uses Card; list-your-venue feature cards → `<Card className="p-5">`). No logic changes.

- [ ] **Step 4: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/nav/SiteHeader.tsx src/app/"(site)"/layout.tsx \
    src/app/"(site)"/login/page.tsx src/app/"(site)"/list-your-venue/page.tsx
  git commit -m "refactor(public): SiteHeader active nav, footer polish, login + list-your-venue"
  ```

---

## Phase 5 — Owner Shell + Dashboard

### Task 12: AppShell and OwnerNav components

**Files:**
- Create: `src/components/nav/OwnerSidebar.tsx`
- Create: `src/components/nav/OwnerMobileNav.tsx`
- Create: `tests/nav/owner-mobile-nav.test.tsx`

`OwnerSidebar` is a server component (renders nav links; no client interactivity needed).
`OwnerMobileNav` is a client component (bottom tab bar + "More" sheet requires `usePathname` and sheet open state).

**Interfaces:**
- `OwnerSidebar` props: `{ session: { email: string }; activeVenueId?: string }`
- `OwnerMobileNav` props: `{ session: { email: string }; activeVenueId?: string }`

- [ ] **Step 1: Write failing test for OwnerMobileNav**

  ```tsx
  // tests/nav/owner-mobile-nav.test.tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";

  vi.mock("next/navigation", () => ({
    usePathname: () => "/owner",
  }));

  const session = { email: "owner@test.com" };

  describe("OwnerMobileNav", () => {
    it("renders the four bottom tab items", () => {
      render(<OwnerMobileNav session={session} />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Calendar")).toBeInTheDocument();
      expect(screen.getByText("Reservations")).toBeInTheDocument();
      expect(screen.getByText("More")).toBeInTheDocument();
    });

    it("opens the More sheet when More tab is tapped", () => {
      render(<OwnerMobileNav session={session} />);
      fireEvent.click(screen.getByText("More"));
      expect(screen.getByText("Reviews")).toBeInTheDocument();
      expect(screen.getByText("Venues")).toBeInTheDocument();
      expect(screen.getByText("Sign out")).toBeInTheDocument();
    });

    it("closes the More sheet when a link inside is clicked", () => {
      render(<OwnerMobileNav session={session} />);
      fireEvent.click(screen.getByText("More"));
      fireEvent.click(screen.getByText("Reviews"));
      // Sheet content should disappear
      expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run to confirm failure**

  ```bash
  npx vitest run tests/nav/owner-mobile-nav.test.tsx
  ```

- [ ] **Step 3: Create OwnerSidebar**

  ```tsx
  // src/components/nav/OwnerSidebar.tsx
  import Link from "next/link";
  import { LayoutDashboard, CalendarDays, BookOpen, Star, Building2 } from "lucide-react";
  import { NotificationBell } from "@/components/notifications/NotificationBell";

  const NAV = [
    { href: "/owner",              label: "Dashboard",    icon: LayoutDashboard, exact: true },
    { href: "/owner/calendar",     label: "Calendar",     icon: CalendarDays },
    { href: "/owner/reservations", label: "Reservations", icon: BookOpen },
    { href: "/owner/reviews",      label: "Reviews",      icon: Star },
    { href: "/owner/venues",       label: "Venues",       icon: Building2 },
  ];

  export function OwnerSidebar({
    session,
    activeVenueId,
  }: {
    session: { email: string };
    activeVenueId?: string;
  }) {
    return (
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-black/5 bg-white lg:flex">
        {/* Wordmark */}
        <div className="flex h-16 items-center border-b border-black/5 px-5">
          <Link href="/owner" className="text-[15px] font-extrabold tracking-tight text-brand-700">
            Rally<span className="text-accent-dark">Point</span>
            <span className="ml-1.5 align-middle text-[11px] font-semibold text-muted">
              for Venues
            </span>
          </Link>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            // Active detection must happen on client; sidebar renders server-side.
            // Use data-href for client-side highlight via CSS or a client wrapper.
            // For now: render without active state; a thin client wrapper in the
            // layout can add active highlighting using usePathname.
            return (
              <Link
                key={item.href}
                href={activeVenueId && item.href !== "/owner"
                  ? `${item.href}?venue=${activeVenueId}`
                  : item.href}
                className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/5 hover:text-ink"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* Bottom: notifications + account */}
        <div className="border-t border-black/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="min-w-0 truncate text-xs text-muted">{session.email}</span>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button className="text-sm font-medium text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    );
  }
  ```

- [ ] **Step 4: Create OwnerMobileNav**

  ```tsx
  // src/components/nav/OwnerMobileNav.tsx
  "use client";

  import { useState } from "react";
  import Link from "next/link";
  import { usePathname } from "next/navigation";
  import { LayoutDashboard, CalendarDays, BookOpen, MoreHorizontal, Star, Building2 } from "lucide-react";
  import { cn } from "@/lib/cn";

  const BOTTOM_TABS = [
    { href: "/owner",              label: "Dashboard",    icon: LayoutDashboard, exact: true },
    { href: "/owner/calendar",     label: "Calendar",     icon: CalendarDays },
    { href: "/owner/reservations", label: "Reservations", icon: BookOpen },
  ];

  const MORE_ITEMS = [
    { href: "/owner/reviews", label: "Reviews" },
    { href: "/owner/venues",  label: "Venues" },
  ];

  export function OwnerMobileNav({
    session,
    activeVenueId,
  }: {
    session: { email: string };
    activeVenueId?: string;
  }) {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);

    return (
      <>
        {/* More sheet backdrop */}
        {moreOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
        )}

        {/* More sheet */}
        {moreOpen && (
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 rounded-t-2xl border-t border-black/5 bg-white px-4 pb-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              More
            </p>
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={activeVenueId ? `${item.href}?venue=${activeVenueId}` : item.href}
                className="flex items-center py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
                onClick={() => setMoreOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-black/5 pt-2">
              <p className="text-xs text-muted">{session.email}</p>
              <form action="/api/auth/logout" method="post">
                <button className="mt-1 text-sm font-medium text-muted hover:text-ink">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto flex max-w-md">
            {BOTTOM_TABS.map((t) => {
              const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
              const Icon = t.icon;
              return (
                <li key={t.href} className="flex-1">
                  <Link
                    href={activeVenueId ? `${t.href}?venue=${activeVenueId}` : t.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                      active ? "text-brand-700" : "text-muted",
                    )}
                  >
                    <Icon className="size-[22px]" aria-hidden />
                    {t.label}
                  </Link>
                </li>
              );
            })}
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  moreOpen ? "text-brand-700" : "text-muted",
                )}
              >
                <MoreHorizontal className="size-[22px]" aria-hidden />
                More
              </button>
            </li>
          </ul>
        </nav>
      </>
    );
  }
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  npx vitest run tests/nav/owner-mobile-nav.test.tsx
  ```

  Expected: PASS — 3 tests.

- [ ] **Step 6: Full verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/nav/OwnerSidebar.tsx src/components/nav/OwnerMobileNav.tsx \
    tests/nav/owner-mobile-nav.test.tsx
  git commit -m "feat(owner): OwnerSidebar (lg+) + OwnerMobileNav (bottom tabs + More sheet)"
  ```

---

### Task 13: Owner layout + dashboard

**Files:**
- Modify: `src/app/(owner)/layout.tsx`
- Modify: `src/app/(owner)/owner/page.tsx`

**The hard invariant for CalendarBoard's `bottom-14` offset:** The existing owner mobile action bar is positioned at `bottom-14`. Our new `OwnerMobileNav` has the same height as `BottomTabBar` (py-2 + 22px icon + 10px label + safe-area = ~56px / 3.5rem). `bottom-14` = 3.5rem in Tailwind. No change needed — the values already match.

- [ ] **Step 1: Replace owner layout header with OwnerSidebar + OwnerMobileNav**

  ```tsx
  // src/app/(owner)/layout.tsx
  import { redirect } from "next/navigation";
  import { getSession } from "@/lib/auth/session";
  import { OwnerSidebar } from "@/components/nav/OwnerSidebar";
  import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";
  import { resolveOwnerVenues } from "@/lib/venue/owner-context";

  export default async function OwnerLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const session = await getSession();
    if (!session || !["OWNER", "STAFF", "ADMIN"].includes(session.role)) {
      redirect("/login?next=/owner");
    }
    // Resolve active venue for nav links (venue-scoped URLs)
    const sp = new URLSearchParams(); // no searchParams here — layout reads nothing
    const { active } = await resolveOwnerVenues(session, undefined);

    return (
      <div className="flex min-h-dvh bg-slate-50">
        <OwnerSidebar session={session} activeVenueId={active?.id} />
        {/* Content: offset by sidebar on lg+ */}
        <div className="flex flex-1 flex-col lg:pl-56">
          <main className="flex-1 px-4 py-6 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6">
            <div className="mx-auto w-full max-w-5xl">
              {children}
            </div>
          </main>
        </div>
        <OwnerMobileNav session={session} activeVenueId={active?.id} />
      </div>
    );
  }
  ```

  Note: `pb-[calc(4rem+env(safe-area-inset-bottom))]` on mobile ensures content isn't hidden behind the new bottom tab bar.

- [ ] **Step 2: Restyle the dashboard to use StatCard**

  In `src/app/(owner)/owner/page.tsx`, remove the local `Stat` component and import `StatCard` from `@/components/ui/stat-card`. Replace the 5 `Stat` usages:

  ```tsx
  import { StatCard } from "@/components/ui/stat-card";
  import { SectionHeader } from "@/components/ui/section-header";
  // Remove local Stat function
  // In the grid:
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    <StatCard icon={<CalendarDays className="size-4" />} label="Today" value={`${todayCount}`} />
    <StatCard
      icon={<Clock className="size-4" />}
      label="Pending"
      value={`${pendingCount}`}
      urgent={pendingCount > 0}
    />
    <StatCard icon={<LayoutGrid className="size-4" />} label="Courts" value={`${activeCourts}`} />
    <StatCard icon={<CircleDollarSign className="size-4" />} label="Revenue" value={pesos(revenue._sum.priceCents ?? 0)} />
    <StatCard icon={<LayoutGrid className="size-4" />} label="Occupancy" value={occupancy} />
  </div>
  ```

  Change the section headings to use `SectionHeader`:
  ```tsx
  <SectionHeader>Needs confirmation ({pendingCount})</SectionHeader>
  <SectionHeader>Upcoming</SectionHeader>
  ```

  Pending/upcoming row items: already use `Card` from Task 3. If not, apply `Card` wrapper now.

- [ ] **Step 3: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Manual check: owner `/owner` — sidebar visible on desktop, bottom tabs on mobile, Pending StatCard turns amber when there are pending bookings.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/"(owner)"/layout.tsx src/app/"(owner)"/owner/page.tsx
  git commit -m "feat(owner): sidebar layout + mobile bottom nav; dashboard uses StatCard"
  ```

---

## Phase 6 — Owner Operations + Admin

### Task 14: Owner calendar, reservations, and reviews

**Files:**
- Modify: `src/app/(owner)/owner/calendar/page.tsx`
- Modify: `src/components/owner/CalendarBoard.tsx`
- Modify: `src/app/(owner)/owner/reservations/page.tsx`
- Modify: `src/app/(owner)/owner/reservations/[reference]/page.tsx`
- Modify: `src/app/(owner)/owner/reviews/page.tsx`

- [ ] **Step 1: Calendar — replace bespoke swatch with Legend**

  In `src/app/(owner)/owner/calendar/page.tsx`, find the inline legend (swatch row of colored divs with labels) and replace with:
  ```tsx
  import { Legend } from "@/components/ui/legend";
  // ...
  <Legend
    items={[
      { dotClass: "bg-white border border-dashed border-brand-500", label: "Available" },
      { dotClass: "bg-amber-100", label: "Held" },
      { dotClass: "bg-sky-100",   label: "Pending" },
      { dotClass: "bg-brand-100", label: "Confirmed" },
      { dotClass: "bg-slate-200", label: "Blocked" },
      { dotClass: "bg-slate-50 border border-black/5",  label: "Closed" },
    ]}
  />
  ```
  Cell state colors in `CalendarBoard.tsx` are not changed.

  In `src/components/owner/CalendarBoard.tsx`: the `bottom-14` mobile action bar offset is correct as-is (matches the new `OwnerMobileNav` height). No change needed.

- [ ] **Step 2: Reservations list — filter pills as segmented control**

  In `src/app/(owner)/owner/reservations/page.tsx`, replace the per-filter pill links with a visually consistent segmented control. The filter logic (`status: "action" | "confirmed" | "all"` from `searchParams`) stays identical:

  ```tsx
  {/* Filter segmented control — links that re-render server-side */}
  <div className="inline-flex overflow-hidden rounded-xl border border-black/10 bg-white text-sm font-medium">
    {(["action", "confirmed", "all"] as const).map((f) => (
      <Link
        key={f}
        href={`/owner/reservations?venue=${venueId}&filter=${f}`}
        className={cn(
          "px-4 py-2 transition",
          filter === f
            ? "bg-brand-600 text-white"
            : "text-ink-soft hover:bg-black/5",
        )}
      >
        {f === "action" ? "Needs action" : f === "confirmed" ? "Confirmed" : "All"}
      </Link>
    ))}
  </div>
  ```

- [ ] **Step 3: Reservation detail — reflow into Cards**

  In `src/app/(owner)/owner/reservations/[reference]/page.tsx`, wrap each distinct section (Customer info, BookingSummary, Payment proof, Confirm/Reject actions, Manage actions, Timeline) in `<Card className="p-5">` with `<SectionHeader>` labels. All existing actions, components, and data stay identical.

- [ ] **Step 4: Reviews page — Card wrappers**

  Reviews page applies `Card` to each review row and uses `SectionHeader`. Logic unchanged.

- [ ] **Step 5: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/"(owner)"/owner/calendar/page.tsx \
    src/components/owner/CalendarBoard.tsx \
    src/app/"(owner)"/owner/reservations \
    src/app/"(owner)"/owner/reviews/page.tsx
  git commit -m "refactor(owner): calendar Legend, reservations segmented filter, detail Cards"
  ```

---

### Task 15: Venue wizard and admin area

**Files:**
- Modify: `src/components/venue-admin/StepRail.tsx`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(admin)/admin/venues/page.tsx`
- Modify: `src/app/(admin)/admin/venues/[id]/page.tsx`

- [ ] **Step 1: Polish StepRail**

  In `src/components/venue-admin/StepRail.tsx`, keep the chip-rail structure and `active`/`done`/numbered states exactly as-is. Improve spacing and sizing to use the project's radius scale (`rounded-xl` for chip edges instead of any `rounded-md`). The `locked` prop behavior and step completion logic in `wizardProgress()` are untouched.

- [ ] **Step 2: Admin layout — use OwnerSidebar pattern**

  In `src/app/(admin)/layout.tsx`, the admin area has a single "Venues" nav item. Create an inline `AdminSidebar` (server component, no shared component needed given its simplicity):

  ```tsx
  // src/app/(admin)/layout.tsx
  import Link from "next/link";
  import { redirect } from "next/navigation";
  import { getSession } from "@/lib/auth/session";
  import { Building2 } from "lucide-react";

  export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") redirect("/login?next=/admin");

    return (
      <div className="flex min-h-dvh bg-slate-50">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-black/5 bg-white lg:flex">
          <div className="flex h-16 items-center border-b border-black/5 px-5">
            <Link href="/admin" className="text-[15px] font-extrabold tracking-tight text-brand-700">
              Rally<span className="text-accent-dark">Point</span>
              <span className="ml-1.5 align-middle text-[11px] font-semibold text-muted">Admin</span>
            </Link>
          </div>
          <nav className="flex-1 py-3">
            <Link href="/admin/venues" className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/5 hover:text-ink">
              <Building2 className="size-4 shrink-0" aria-hidden />
              Venues
            </Link>
          </nav>
          <div className="border-t border-black/5 px-5 py-4">
            <p className="text-xs text-muted">{session.email}</p>
            <form action="/api/auth/logout" method="post" className="mt-1">
              <button className="text-sm font-medium text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </aside>
        {/* Mobile header — keep simple for admin (no mobile nav needed, admin is desktop-primary) */}
        <header className="sticky top-0 z-40 border-b border-black/5 bg-white lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link href="/admin" className="text-[15px] font-extrabold tracking-tight text-brand-700">
              Rally<span className="text-accent-dark">Point</span>
              <span className="ml-1.5 text-[11px] font-semibold text-muted">Admin</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/admin/venues" className="text-sm font-medium text-ink-soft">Venues</Link>
              <form action="/api/auth/logout" method="post">
                <button className="text-sm font-medium text-muted">Sign out</button>
              </form>
            </div>
          </div>
        </header>
        {/* Content */}
        <div className="flex flex-1 flex-col lg:pl-56">
          <main className="flex-1 px-4 py-6">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Admin venue list — status filter polish**

  In `src/app/(admin)/admin/venues/page.tsx`, apply the same segmented-control treatment for the five status filters (Pending review, Approved, Rejected, Suspended, All). Logic unchanged.

- [ ] **Step 4: Admin review dossier — Card sections**

  In `src/app/(admin)/admin/venues/[id]/page.tsx`, wrap each dossier section (owner note, photos, description, Amenities, courts, hours, payment methods, Decision + ReviewActions) in `<Card className="p-5">` with `<SectionHeader>` labels. `Amenities` component: unchanged (already prop-compatible). `ReviewActions`: unchanged.

- [ ] **Step 5: Verify**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/venue-admin/StepRail.tsx \
    src/app/"(admin)"/layout.tsx \
    src/app/"(admin)"/admin/venues
  git commit -m "refactor(owner+admin): wizard StepRail polish, admin sidebar layout, Card sections"
  ```

---

## Phase 7 — Responsive Sweep + Final Verification

### Task 16: Responsive sweep and final checks

**Files:**
- Modify: any file found to have overflow, clipping, or tap-target issues at the target widths.

- [ ] **Step 1: Start dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Test at 360px, 375px, 390px, 412px (portrait mobile)**

  In your browser's DevTools or device emulator, check at each width:
  - `/` — hero, SearchBar, VenueCard grid
  - `/search` — filters + results
  - `/venues/[slug]` — Gallery hero edge-to-edge, hero title block, Tabs (scrollable), Book tab (MobileCourtPicker), DateRail, sticky Continue bar (check it doesn't cover BottomTabBar)
  - `/book/[reference]` — checkout steps + HoldCountdown
  - `/bookings` — list rows
  - `/bookings/[reference]` — status page
  - `/owner/*` — mobile tab bar visible, More sheet opens, dashboard StatCards wrap correctly, CalendarBoard mobile action bar at bottom-14

  Fix any overflow (`overflow-x: hidden` on body should catch most) or clipped text.

- [ ] **Step 3: Test at 768px (tablet)**

  Check the transition between mobile/desktop layouts at the `md` breakpoint — ScheduleGrid appears, MobileCourtPicker hidden, OwnerSidebar still hidden at md (shows at lg). Fix any gaps.

- [ ] **Step 4: Test at 1280px (desktop)**

  OwnerSidebar visible, content offset by `pl-56`, venue ScheduleGrid comfortable. Check horizontal scroll on the grid only if > N courts overflow.

- [ ] **Step 5: Final full verification**

  ```bash
  npm run typecheck && npm run lint && npm run test && npm run build
  ```

  Expected: typecheck — 0 errors; lint — 0 errors; test — 42 files / ≥186 tests (42 original + 12 new) pass; build — succeeds.

- [ ] **Step 6: Commit**

  ```bash
  git add -A  # only the specific files changed during the sweep
  git commit -m "fix(responsive): mobile/tablet sweep — overflow, tap targets, breakpoint transitions"
  ```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Inter via `next/font` | Task 1 |
| Radius normalization, `rounded-md` → `rounded-xl` | Task 4 |
| Unified `Card`, `--shadow-card` consistent | Task 3 |
| New primitives: `Tabs`, `SectionHeader`, `StatCard`, `Legend` | Task 2 |
| Venue page hero block (name, badge, rating, price, location, CTA) | Task 5 |
| URL-driven Home\|Book\|Reviews tabs via `?tab=` | Task 5 |
| Compatibility rule: `?date`/`?duration` → auto-resolves to `tab=book` | Task 5 |
| DateRail hrefs include `&tab=book` | Task 5 |
| Home tab: About, Amenities, Hours, **Contact** (newly surfaced), Location, House rules | Task 5 |
| Reviews tab: existing summary + distribution + review cards | Task 5 |
| ScheduleGrid (desktop: time×court, bands, in-cell prices) | Task 6 |
| MobileCourtPicker (court chips → banded slots, client state) | Task 7 |
| Legend (Available, Selected, Unavailable) above schedule | Task 8 |
| Sticky Continue bar unchanged (z-30, `bottom-16`, `md:bottom-0`) | Task 8 |
| Home page polish | Task 9 |
| Search page polish | Task 9 |
| Checkout / bookings polish | Task 10 |
| SiteHeader active nav, footer, login, list-your-venue | Task 11 |
| `OwnerSidebar` (lg+ fixed left) + `OwnerMobileNav` (bottom tabs + More sheet) | Task 12 |
| Owner layout uses AppShell pattern | Task 13 |
| Dashboard uses `StatCard`, `SectionHeader`, pending `urgent` highlight | Task 13 |
| Calendar Legend replaces bespoke swatch | Task 14 |
| Reservations segmented filter, detail Cards | Task 14 |
| Venue wizard StepRail polish | Task 15 |
| Admin sidebar layout | Task 15 |
| Admin review dossier Card sections | Task 15 |
| Responsive sweep (360/375/390/412/768/1280) | Task 16 |
| `Amenities` prop-compatible | Task 5 (unchanged) |
| Z-order invariants preserved | Tasks 8, 12, 13 |
| All 42 test files + new component tests green | All tasks |

All spec requirements covered. No `TBD` or placeholder steps.
