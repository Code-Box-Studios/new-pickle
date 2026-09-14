# Venue booking page — UI/UX pass (design)

Date: 2026-09-08 · Branch: `build/venue-location`

## Goal

Make the public venue page (`/venues/[slug]`) feel like a polished, compact,
mobile-first sports-booking app with much less scrolling and a clear
Venue → Date → Duration → Court → Time → Continue hierarchy.

**Strictly UI/UX.** No change to booking logic, the `/api/bookings` behavior,
availability rules, pricing, durations, or any data shape. The date/duration
selectors keep driving availability via `searchParams` (server re-render).

## Scope (files)

- `src/app/(site)/venues/[slug]/page.tsx` — shell/spacing, full-bleed hero,
  tighter header, promoted "Book a court", wires the new date rail, passes a
  presentational `selectedDateLabel`, lightly restyled duration chips.
- `src/components/court/CourtBooking.tsx` — compact court cards with a subtle
  status dot; time slots move from `flex-wrap` to a responsive **CSS grid**
  (3 cols → 4/6/8 as width grows), consistent `h-11` buttons that never clip
  "10:00 AM"; sticky summary restyled to the mockup with a prominent
  **Continue** CTA. All `select`/`reserve`/idempotency logic untouched.
- `src/components/court/DateRail.tsx` — **new** small client component. Renders
  the same `<Link>` chips (same hrefs, same server navigation) with a compact
  fixed-width design, green selected / white unselected, scroll-snap, hidden
  scrollbar, and **auto-scrolls the active chip into view** (container-only
  scroll, no page jump; no animation, reduced-motion safe).
- `src/components/venue/Amenities.tsx` — compact 2-col grid, `size-3.5` checks,
  `text-[13px]`. Prop-compatible (also used on the admin venue page).
- `src/components/venue/Gallery.tsx` — mobile hero goes edge-to-edge with
  `rounded-b-3xl`; `sm+` keeps the contained rounded card + thumbnails.
- `src/components/nav/BottomTabBar.tsx` — slightly more compact.
- `src/components/dev/ShareToPhonePanel.tsx` — dev-only; on mobile collapse to
  an icon-only FAB moved bottom-left above the nav so it never covers the
  right-aligned Continue button, the time slots, or the nav.

## Decisions (confirmed with user)

- CTA label: **Continue** (proceeds to `/book/[reference]`).
- Hero: **full-bleed with rounded bottom** on mobile.
- Amenities: **always show**, compact grid (no toggle).

## Preserved (off-limits)

`select`/`reserve`/`POST /api/bookings`/`Idempotency-Key`/toast; which slots
render and their available/unavailable states; date+duration→availability
navigation; pricing (`pesos`, `priceCents`); `DURATIONS`; all DTO shapes; the
availability engine and every API route.

## Verification

typecheck → lint → existing Vitest suite → `next build`; then run the dev
server and screenshot at 360/375/390/412px, fixing any overflow (except the
intentional date carousel), clipping, or nav/summary overlap.
