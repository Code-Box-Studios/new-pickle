# RallyPoint UI/UX redesign (design)

Date: 2026-09-14 · Branch: `build/venue-location` · Builds on the committed
2026-09-08 venue booking UI pass (`953a98c`).

## Goal

Restructure RallyPoint's presentation layer into a modern, premium,
mobile-first venue-booking platform, using picklehub.ph's layout principles
(venue hero → tabs → schedule grid → info sections; sidebar admin) as
**inspiration only** — no copied content, text, branding, images, or code.
Strictly UI/UX: every feature, API, data shape, and workflow behaves exactly
as it does today.

**Approach (confirmed):** evolve the existing design language (emerald brand,
lime accent, Tailwind v4 `@theme` tokens) rather than rebrand or minimally
polish.

## Decisions (confirmed with user)

1. In-flight 2026-09-08 venue UI pass: verified (typecheck, lint, 42 test
   files / 180 tests, `next build`) and committed first; redesign builds on it.
2. Venue page: **real URL-driven tabs** — Home | Book | Reviews via `?tab=`,
   server-rendered `<Link>` navigation like the existing `?date=` pattern.
3. Schedule: **time-rows × court-columns grid on `md+`; court-chip picker on
   mobile** (no shrunken table on phones).
4. Overall approach: A — evolve existing design language, land in verified
   phases on this branch.
5. All seven design sections approved as presented (2026-09-14).

## 1. Design system foundation

- **Font:** load Inter via `next/font` in the root layout; the existing
  Inter-specific `font-feature-settings` in `globals.css` finally apply.
- **Tokens:** keep the emerald `--color-brand-50..950` ramp, lime accent,
  ink/ink-soft/muted text scale, `--shadow-card`, `--radius-card`. No dark
  mode.
- **Radius tiers (normalize):** `rounded-2xl` cards · `rounded-xl` controls ·
  `rounded-lg` small chrome · `rounded-full` pills/badges. Replace stray
  `rounded-md` (MagicLinkBanner, PhotoManager, PaymentMethodEditor,
  CourtEditor).
- **Card:** the `src/components/ui/card.tsx` primitive becomes the one card;
  the ~11 files hand-rolling `rounded-2xl border-black/5 bg-white` divs adopt
  it, with `--shadow-card` applied consistently.
- **New primitives (presentation-only):**
  - `Tabs` — underline style (2px bottom border on active, semibold label),
    renders `<Link>`s for URL-driven tabs, horizontally scrollable with a
    hidden scrollbar on mobile.
  - `SectionHeader` — unified section label typography.
  - `StatCard` — KPI card for dashboards.
  - `Legend` — compact status color-chip row.
  - `AppShell` — sidebar layout used by the owner and admin areas (desktop
    fixed left sidebar; mobile bottom tab bar + "More" sheet).
- **Unchanged APIs:** Button, Badge/BookingStatusBadge, Input/Field, Select,
  Dialog, Toast, EmptyState/ErrorState keep their props; styling tweaks only.
  Booking-status colors keep today's meanings (amber/sky/emerald/red/slate).

## 2. Venue page — hero + tabs (`/venues/[slug]`)

Order: Gallery (committed full-bleed mobile hero, unchanged) → title block:
venue name + Verified badge → ★ rating + review count → **"From ₱X/hr"**
(minimum court `priceCents`, same computation VenueCard uses) → MapPin
location line → primary **Book a court** CTA linking `?tab=book`.

Below: underline `Tabs` — **Home | Book | Reviews** — via `?tab=` searchParam.

- Default tab: Home. **Compatibility rule:** a URL carrying `date` or
  `duration` without `tab` resolves to Book, so existing deep links (search
  next-slot chips, old bookmarks) keep working. DateRail/duration links carry
  `tab=book` explicitly.
- Only the active tab's content renders (server-side, same page component).
- **Home tab:** About → Amenities as icon-based items (lucide icon per
  existing 12 amenity keys; component stays prop-compatible — the admin
  dossier reuses it) → Operating hours → **Contact** (surface existing,
  currently-unrendered `contactNumber` and `website` fields) → Location
  (address + existing Google Maps link; no embedded map) → House rules.
- **Reviews tab:** existing average, distribution bars, and review cards —
  same query, same 6-recent limit.
- JSON-LD script and the owner/admin preview banner stay exactly where they
  are (rendered regardless of tab).

## 3. Booking schedule (Book tab)

DateRail + duration pills as committed. Below them, two renderings of the
same `CourtDTO`/`SlotDTO` data:

- **Desktop (`md+`):** grid with a time column and one column per court.
  Column headers: court name + Indoor/Outdoor + ₱/hr. Rows = the union of
  slot start times across courts (per-court hours differ); a court without a
  given slot renders an empty/disabled cell. Rows grouped under Morning /
  Afternoon / Evening band labels. Each cell is a slot button with its price
  (`priceCents`) shown in-cell; unavailable cells muted/disabled. Horizontal
  scroll only if courts overflow the container.
- **Mobile (`< md`):** court selector chips (name + status treatment for
  Closed / Fully booked) above the selected court's slot grid, grouped by the
  same bands. Pure client state; defaults to the first court with
  availability, else the first court. No URL or data-flow change.
- **Legend:** compact chips above the schedule, only states that exist
  publicly — Available, Selected, Unavailable — plus Closed / Fully booked
  styling on court headers/chips.
- **Selection behavior identical:** tap slot → fresh `crypto.randomUUID()`
  idempotency key → sticky summary bar (unchanged `bottom-16`/`md:bottom-0`
  placement and z-30 order) → Continue POSTs `/api/bookings` with the
  `Idempotency-Key` header → `/book/[reference]`; 401 → login with `next=`;
  409 → toast + clear + refresh. Single start-time + duration selection only
  (no multi-slot — the API takes one `startsAt`).

## 4. Public site polish (no structural changes)

- **Home:** hero + SearchBar card + Popular venues grid + how-it-works keep
  their structure; unified Card/typography; stronger VenueCard hierarchy.
- **Search:** same URL-driven flow and 45s-cached results; cleaner results
  header and card grid.
- **Checkout `/book/[reference]`:** same step branching (dead / HELD →
  DetailsForm / PENDING_PAYMENT → PaymentStep); restyled with Card sections;
  HoldCountdown stays server-authoritative.
- **`/bookings` + `/bookings/[reference]`:** same sections (Upcoming/Past,
  5-step progress, payment info, StatusTimeline, ReviewPrompt) in the unified
  card language.
- **Login, list-your-venue, footer, SiteHeader, BottomTabBar:** restyle only;
  same links and behavior.

## 5. Owner portal

- **Shell (`AppShell`):** desktop (`lg+`) fixed left sidebar — wordmark,
  VenueSwitcher, nav (Dashboard · Calendar · Reservations · Reviews ·
  Venues), NotificationBell + account/sign-out at bottom. Below `lg`: owner
  bottom tab bar — Dashboard, Calendar, Reservations, **More** (sheet with
  Reviews, Venues, notifications, sign out). This adds the currently-missing
  owner mobile nav and legitimizes CalendarBoard's existing `bottom-14`
  mobile action bar assumption (offsets re-synced deliberately).
- **Nav contains only existing modules** — no Payments/Reports/Players/
  Settings items (those pages don't exist).
- **Dashboard:** same data, rearranged to answer "today → needs attention →
  next": StatCard row (Today, Pending — emphasized when > 0, Courts, Revenue,
  Occupancy), quick actions (Open calendar / New booking / Block court, same
  `?new=1`/`?block=1` deep links), then Needs-confirmation and Upcoming card
  lists. Non-approved venues keep the amber setup callout.
- **Calendar:** same server-rendered day/week URL navigation and six cell
  states (AVAILABLE, HELD, PENDING, CONFIRMED, BLOCKED, CLOSED) with today's
  color meanings, restyled; bespoke swatch row replaced by the shared
  `Legend`. NewBookingDialog/BlockDialog functionality identical.
- **Reservations:** filter pills as a consistent segmented control (same
  three filters); rows as cards; detail page reflowed into Cards (customer,
  summary, payment proof, confirm/reject highlight, manage, timeline) with
  identical actions.
- **Venue wizard:** StepRail restyled; all six steps keep their forms and
  `locked` (PENDING_REVIEW) behavior; shared `Field` styling.

## 6. Admin area

Same `AppShell` (single Venues nav section). Venue list keeps its status
filters; the review dossier reflows into Cards; ReviewActions
(approve/reject/suspend/reinstate, reject-reason required) identical.

## 7. Phasing & verification

Each phase lands as its own commit(s) on this branch; before moving on:
`npm run typecheck` → `npm run lint` → `npm run test` (42 files / 180 tests
green today) → `npm run build`.

1. Design-system foundation (Inter, Card adoption, new primitives, radius
   normalization). All pages still render.
2. Venue hero + tabs.
3. Schedule grid (desktop) + court picker (mobile) + legend.
4. Public polish (home, search, checkout, bookings, login).
5. Owner shell (sidebar + mobile tabs) + dashboard.
6. Owner calendar/reservations/wizard + admin.
7. Responsive sweep (360/375/390/412 px + tablet + desktop) + final full
   verification, including a manual mobile pass in dev.

New stateful client components (mobile court picker, More sheet) get
component tests; pure restyles are covered by the existing suite + build.

## Hard invariants (off-limits)

- No changes to any `/api` route, request/response payload, or DTO shape
  (SlotDTO/CourtDTO/PaymentMethodDTO etc.).
- No Prisma schema or migration changes; no new data requirements.
- searchParams-driven server rendering stays (`?date`, `?duration`, `?venue`,
  calendar params; `?tab` joins the same pattern, `<Link scroll={false}>`).
- Idempotency-key-per-selection, server-authoritative hold expiry, login
  `next=` redirects, role gates ((owner)/(admin) layout guards), booking and
  venue status machines, notification polling — all untouched.
- `Amenities` stays prop-compatible (admin dossier reuse).
- Z-order/offset choreography preserved or re-synced as a set: BottomTabBar
  height ↔ summary `bottom-16` ↔ page `pb-24` ↔ dev FAB z-20 < summary z-30 <
  QR panel z-[90].
- No invented features: no events/open-play UI, no fake data, no new nav
  items for nonexistent modules.
