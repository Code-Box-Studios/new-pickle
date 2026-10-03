---
version: alpha
name: Pikol
description: Modern court discovery and management using the supplied MongoDB visual reference.
colors:
  primary: "#00ed64"
  brand-green: "#00ed64"
  brand-green-dark: "#00684a"
  brand-green-mid: "#71e8ab"
  brand-green-soft: "#e3fcf7"
  brand-teal-deep: "#001e2b"
  brand-teal-mid: "#0c4e50"
  canvas: "#ffffff"
  surface: "#f5f8f7"
  surface-soft: "#f9fbfa"
  hairline: "#dce4e7"
  hairline-strong: "#b8c4ca"
  hairline-dark: "rgba(255, 255, 255, 0.35)"
  ink: "#001e2b"
  slate: "#3d4f58"
  steel: "#5c6c75"
  on-dark: "#ffffff"
  on-dark-muted: "rgba(255, 255, 255, 0.75)"
  on-primary: "#001e2b"
  primary-pressed: "#00c957"
  semantic-warning-bg: "#fff8dc"
  semantic-warning-text: "#765b00"
  destructive: "#b42318"
typography:
  hero-display:
    fontFamily: Euclid Circular A
    fontSize: 72px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -1.5px
  heading-1:
    fontFamily: Euclid Circular A
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.5px
  heading-2:
    fontFamily: Euclid Circular A
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.5px
  heading-3:
    fontFamily: Euclid Circular A
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.3
  heading-4:
    fontFamily: Euclid Circular A
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.35
  heading-5:
    fontFamily: Euclid Circular A
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  subtitle:
    fontFamily: Euclid Circular A
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Euclid Circular A
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Euclid Circular A
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption-bold:
    fontFamily: Euclid Circular A
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  micro-uppercase:
    fontFamily: Euclid Circular A
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 1px
  button-md:
    fontFamily: Euclid Circular A
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
  code-md:
    fontFamily: Source Code Pro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
  section-lg: 96px
  hero: 120px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    height: 44px
  button-on-dark:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    height: 44px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    height: 44px
  button-secondary-on-dark:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    height: 44px
    borderColor: "{colors.hairline-dark}"
  card-base:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    borderColor: "{colors.hairline}"
  venue-setup-section:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  venue-setup-tab-active:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.full}"
    height: 48px
  venue-setup-save-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.slate}"
    rounded: "{rounded.lg}"
  venue-setup-mobile-navigation:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 56px
  venue-setup-mobile-save-actions:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    height: 69px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 44px
    borderColor: "{colors.hairline-strong}"
  field-description:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.steel}"
    typography: "{typography.body-sm}"
  body-copy:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.slate}"
    typography: "{typography.body-md}"
  workspace:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
  quiet-section:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  court-illustration:
    backgroundColor: "{colors.brand-teal-mid}"
    textColor: "{colors.brand-green-mid}"
  badge-warning:
    backgroundColor: "{colors.semantic-warning-bg}"
    textColor: "{colors.semantic-warning-text}"
    rounded: "{rounded.full}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.full}"
  badge-green-soft:
    backgroundColor: "{colors.brand-green-soft}"
    textColor: "{colors.brand-green-dark}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
  hero-band-dark:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.on-dark}"
    typography: "{typography.hero-display}"
  footer-region:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.on-dark-muted}"
    padding: "{spacing.section}"
  brand-mark:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.brand-green}"
    rounded: "{rounded.lg}"
  court-score:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.brand-green-dark}"
    rounded: "{rounded.md}"
  rally-illustration:
    backgroundColor: "{colors.brand-green-soft}"
    textColor: "{colors.brand-green-dark}"
    rounded: "{rounded.lg}"
  brand-showcase:
    backgroundColor: "{colors.brand-teal-deep}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xxl}"
  date-picker:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 44px
  city-combobox:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 44px
---

# Pikol design system

## Overview

A clean, modern pickleball marketplace with the supplied MongoDB identity:
deep teal hero bands, green pill actions, white cards, and pale mint emphasis.
Public discovery pages have generous spacing. Owner and admin workspaces use
compact, clearly grouped information and aligned navigation.

## Colors

Use {colors.brand-green} for the primary action and {colors.brand-teal-deep}
for hero bands, sidebar navigation, and the footer. Use {colors.ink} for text
on white, {colors.brand-green-dark} for links, and {colors.steel} for metadata.
Use warning and destructive tokens only for meaningful application states.

## Typography

Euclid Circular A is the preferred family. No licensed font asset was supplied;
the app falls back to Apple/system fonts, Segoe UI, Roboto, and sans-serif.
Reserve Source Code Pro for code. Display text has tight leading and tracking;
body text uses {typography.body-md}. Mobile heroes scale from 36px to 72px on
wide screens. Small emphasis and buttons use weight 600.

## Layout

Use a 1280px maximum container with 16px mobile, 24px tablet, and 32px desktop
gutters. Marketing sections use 64–96px vertical spacing. The homepage search
panel bridges the hero and white canvas. Venue grids use one, two, then three
columns. Management workspaces use a 256px desktop sidebar and mobile navigation.

## Elevation & Depth

Default cards use a 1px hairline border and little or no shadow. Floating search
and photo surfaces use restrained teal shadows. Hero gradients and subtle brand
orbits add depth. Dialogs use a soft backdrop blur and the shared elevated shadow.

## Shapes

Buttons and status badges are pills. Cards use {rounded.lg}; inputs use
{rounded.md}. Keep court imagery clipped within the same card geometry.

## Components

Shared controls use locally owned shadcn components. Booking schedules and
calendars compose those controls while retaining their domain behavior. Radix
Select menus support keyboard selection; links preserve route semantics.
Date controls compose shadcn Calendar and Popover, with green selected-day pills.
The nationwide city combobox composes shadcn Command and Popover, showing city
and province with keyboard search. Both overlays fit the available viewport.

Page changes fade for 300ms. Hero entrances stagger by 60ms with a smooth easing
curve. Dialogs enter for 320ms and exit for 180ms. Scroll reveals enhance browsers
with view timelines; other browsers display the sections normally. Reduced
motion disables added movement. Route wrappers never animate transforms because
booking actions must remain fixed to the viewport.

Demo venue images use a local court illustration in place of the seed data's
random stock placeholders. The image component preserves real uploaded media.
Outlined button tokens describe their effective white or teal surface; their
CSS background is transparent.

The Pikol mark combines a paddle, a P monogram, and a perforated ball.
Use the same mark in the header, footer, workspace navigation, and favicon.
The homepage hero showcases only Pikol branding: its mark, wordmark,
paddles, ball, and orbital lines. Keep venue promotions in discovery sections.
Court boundaries, net lines, score tiles, and paddle details carry the identity
through search, discovery, booking steps, the owner banner, and the footer.
The decorative rally follows its section's scroll timeline where supported;
other browsers get one short entrance. The hero wordmark uses a perforated ball
for its “o”, a slanted display treatment, a soft mint sheen, and a rally swoosh.
The logo's white ball leaves its mark, rallies between the paddles, and returns
to its place in a nine-second loop. Responsive SVG coordinates keep its contact
points aligned with the paddles. Paddle returns accompany the ball; logo and
atmospheric motion remain gentle.
Its pause control stops all motion; animation also pauses offscreen and in
background tabs. Reduced-motion preferences render a still composition.
Header and footer logo motion remains brief and tied to interaction.
The sticky header is transparent at the top of Home, sign-in, sign-up, and venue onboarding,
with white text over the dark intro. After 16px of scroll its white panel, light
border, and restrained shadow fade in over 300ms, and text switches to dark teal.
White-content pages use the white panel throughout. The transparent surround
overlays each dark intro, with extra padding to keep content clear of the bar.
Active links use green icons and a translucent pill at the hero top, switching
to dark teal pills on white.
Mobile navigation opens in an inset, rounded shadcn Sheet with a teal brand area,
large navigation targets, and a scrollable link region for shorter screens.
Home links explicitly return to the top, including repeat activations. Search
anchors retain their smooth scroll and the sticky header offset.

Shared shadcn buttons keep pill silhouettes and consistent touch targets.
Primary actions have a fine highlight rim, secondary actions use soft mint,
and outlined actions use quieter borders. Ghost and link actions remain light.
Interaction motion uses a brief light sweep, directional arrows, and restrained
elevation. Press feedback compresses to 97% over 100ms; other transitions use
200ms easing. Disabled and loading actions suppress motion, and reduced-motion
preferences keep controls still. City and date triggers stay in place.

Venue booking uses a soft canvas with bordered white panels. The gallery and
venue overview sit beside the booking panel on desktop; on smaller screens,
booking follows the overview and precedes long venue details. Three numbered
controls guide day, duration, and start-time selection. The calendar extends
beyond the seven-day rail, and time-of-day tabs narrow the schedule. Slots show
session totals, with clear selected and unavailable states. A floating summary
shows the chosen court, date, full time range, and total; it sits above phone
navigation. Changing the day or duration clears the old choice. Photos open
in a shadcn Dialog with keyboard navigation and previous/next controls.

Sign-in and sign-up share a dark intro with a white {rounded.lg} form card.
Desktop pairs the form with Pikol's paddle-and-ball illustration and three short
benefits; smaller screens prioritize the form. Email and phone methods use
shadcn pill tabs with 44px targets, 52px inputs, and green primary actions.
Verification states use quiet mint panels, a readable six-digit code field,
and actions to correct an address or number. Switching methods fades in for
240ms; page entrances are brief, and reduced-motion preferences keep them still.
Links between sign-in and account creation retain the player's return path.

Venue setup uses a compact workspace header. Desktop shows six numbered pill
tabs in a white rail; below 1024px, a 56px current-step button opens a shadcn
Popover with all six destinations. Progress counts the five prerequisite
sections; Review is a final action, not a completed prerequisite. Mobile hides
repeated step eyebrows and section descriptions to bring fields higher on the
page. Form sections have mint icon circles, plain headings, short hints, and
white bordered cards. Wider screens pair details with a live listing preview.
Amenities use icon pills with visible selected states. Desktop keeps a sticky
save card; mobile uses a full-width 69px action bar above the 64px bottom
navigation, adjusted for safe areas. Two equal-width 44px buttons offer draft
and continue actions. Reserved form space keeps the last fields clear of the
bar. Photo uploads and empty steps use restrained mint surfaces, with consistent
back and next actions. Existing button motion and reduced-motion rules apply
throughout setup.

## Do's and Don'ts

- Use green pill buttons for the main action.
- Keep white cards flat, readable, and consistently rounded.
- Maintain visible focus and native form behavior.
- Respect reduced-motion preferences and keep content server rendered.
- Do not use bright green for body text or large backgrounds.
- Do not add unrelated pricing, course categories, or code mockups.
- Do not change booking, payment, availability, or authorization behavior during
  visual refinement.
