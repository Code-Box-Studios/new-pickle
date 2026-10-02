# RallyPoint shadcn/ui migration

Date: 2026-10-01

## Goal and scope

Use shadcn/ui as the shared component foundation throughout the public site,
owner portal, and admin area. Apply the user's MongoDB design reference:
deep teal hero bands, bright green pill actions, white surfaces, mint accents,
12px cards, and geometric typography. Preserve accessibility and workflows.

"All components" means that shared controls and presentation primitives use
shadcn/ui implementations wherever shadcn has an equivalent. RallyPoint-specific
components such as the booking schedule, venue card, owner calendar, and status
timeline remain application components. They compose shadcn primitives for
their buttons, fields, cards, dialogs, badges, and feedback. A semantic element
with no useful shadcn equivalent remains native HTML.

## Existing context

- Next.js 16, React 19, Tailwind CSS 4, and a `src/` import alias are already in
  place. Shared UI lives in `src/components/ui/` and is imported across all
  three application areas.
- The app already uses Radix dialog and toast primitives. Existing `<select>`
  controls intentionally use the browser's native mobile picker.
- Server-rendered route links and query parameters drive search, venue dates,
  booking pages, owner filters, and calendar navigation. Those URLs must retain
  their behavior and link semantics.
- Before migration, typecheck and lint pass, and Vitest reports 49 files and
  216 passing tests against the local PostgreSQL test database.

## Chosen approach

Initialize shadcn/ui in this existing project with the Radix base and CSS
variables. Keep generated, locally owned primitives in `src/components/ui/`.
Map shadcn semantic colors and radii to the supplied MongoDB design tokens
instead of introducing a second visual language. Use shadcn Radix Select custom menus for
simple choices and Sonner for toast notifications, following the current Radix
component guidance.

Migrate in two layers:

1. Replace the shared primitive implementations with shadcn components. Where
   existing application props carry useful behavior, preserve them through a
   small compatibility API or update callers together. In particular, keep
   `Button` loading and block behavior, `Field` label/error descriptions,
   controlled select values and form submission, dialog title and mobile sheet placement,
   booking/venue badge tones, and toast call sites.
2. Audit every application component and page for raw interactive and card-like
   UI. Use the migrated primitives or shadcn composition where appropriate.
   Keep native links for navigation, native file inputs where required, and
   semantic tables/fieldsets when replacing them would reduce usability.

Keep RallyPoint's brand and content while adopting the supplied visual system.
The booking grid, owner mobile navigation, and sticky booking actions retain
their behavior. Use #00ed64 for primary actions and #001e2b for deep teal bands.
Declare Euclid Circular A with the supplied system fallbacks; no licensed font
asset was supplied. Reserve saturated category colors for category tags, and
use restrained semantic tints for booking status and validation.

## Component mapping

| Current UI                    | shadcn foundation                                     | Required behavior                                                         |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Button and `buttonVariants`   | Button                                                | Existing variants, sizes, loading, disabled, full width, and link styling |
| Input and Field               | Input, Field, Label, Textarea where applicable        | Label association, hint/error IDs, invalid state, native form submission  |
| Select                        | Radix Select                                          | Custom menu, keyboard selection, and controlled values                            |
| Card, StatCard, EmptyState    | Card, Skeleton, Empty where useful                    | Current layout and empty-state actions                                    |
| Badge and status badges       | Badge                                                 | Status labels and color meanings                                          |
| Dialog                        | Dialog                                                | Focus management, Escape/close, mobile bottom-sheet styling               |
| ToastProvider and `useToast`  | Sonner Toaster and toast API                          | Existing success/error messages, positioning, accessibility               |
| Tabs and segmented navigation | shadcn styling and native Next links                  | URL and server-rendered navigation remain authoritative                   |
| Brand, Legend, SectionHeader  | App compositions using shadcn primitives where useful | Branding and content semantics remain intact                              |

The shadcn registry is source code copied into this repository. Local styling
changes belong in those files and the token layer; avoid a parallel set of
generic controls that visually diverges from shadcn.

## Data and interaction flow

This is a presentation migration. No Prisma schema, API route, request body,
response body, booking status transition, authorization rule, or availability
calculation changes. Client components continue to call the same endpoints.
The booking idempotency key, server hold countdown, query-parameter navigation,
notification polling, and role gates remain unchanged.

Form errors stay next to their controls with `aria-invalid` and associated
descriptions. Dialogs remain keyboard accessible. Toasts report server or
network errors without changing their handling. Buttons that trigger requests
remain disabled while submitting. Links remain links, including ones styled as
buttons.

## Verification and completion criteria

- shadcn is configured for this repository and the shared UI files are built
  from its Radix components; no competing bespoke implementation remains for a
  control with an adopted shadcn equivalent.
- Public, owner, and admin components use the new primitives consistently.
- Existing behavior-focused tests continue to pass. Add targeted tests for
  meaningful compatibility contracts: loading/disabled buttons, field errors
  and accessibility IDs, custom select behavior, dialogs, and toast feedback.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- Manually check the public home/search/venue/booking flow, owner dashboard,
  calendar and venue wizard, and admin review at mobile and desktop widths.
- The source migration changes no booking, venue, review, payment, notification,
  or Sentry backend logic.

## Alternatives considered

- **Adopt shadcn defaults everywhere:** faster initial scaffolding, but it
  discards an established visual design and creates avoidable responsive drift.
- **Install shadcn beside the custom library:** smaller first diff, but it
  leaves two competing primitive systems and does not satisfy the request to
  use shadcn throughout the app.

## Deliberate limits

This migration does not add dark mode, new screens, new
backend capabilities, or new form libraries. It does not replace domain-specific
components with unrelated registry examples merely to remove custom code.

## Modern layout and motion refinement (2026-10-02)

The user additionally requested a modern, clean redesign and smooth animations,
with design decisions handled autonomously. The homepage uses a floating white
search panel across the teal/white boundary, a subtle court-line backdrop,
mint headline emphasis, and a more spacious feature layout. Owner and admin
workspaces gain aligned navigation and compact utility headers.

Motion uses CSS rather than an additional framework: short page fades,
staggered hero entrances, card and button feedback, and Radix dialog/sheet
transitions. Scroll reveals progressively enhance browsers with view timelines;
other browsers render the content normally. Route fades use opacity only to
preserve fixed mobile booking actions. Reduced-motion preferences disable
entrances, scroll effects, and movement. Content remains server rendered.
