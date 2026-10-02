# RallyPoint shadcn and MongoDB design migration

Spec: `docs/superpowers/specs/2026-10-01-shadcn-ui-migration-design.md`

## Constraints

Use the user's MongoDB reference on all existing public, owner, and admin screens.
Preserve URLs, native form behavior, API contracts, booking state, accessibility,
and responsive navigation. Keep RallyPoint's content and brand. Use Euclid
Circular A when installed, with the requested system fallbacks. No font asset
was supplied. Do not add unrelated pricing, courses, or developer mockups.

## Task 1: shadcn foundation

Install registry Button, Card, Input, Radix Select, Textarea, Label, Field,
Badge, Dialog, Skeleton, Sonner, Checkbox, Radio Group, Switch, Tabs, Table,
Accordion, and Sheet. Adapt existing loading, field, badge, dialog, and toast
interfaces. Configure semantic tokens with green primary, deep teal ink,
white surfaces, 12px cards, 8px inputs, and pill buttons.

Produces: shared primitives and semantic CSS tokens consumed by every screen.
Verify: primitive accessibility and compatibility tests plus typecheck.
Expected: tests pass; no consumer interface errors.

## Task 2: application controls

Replace remaining bespoke buttons, textareas, choices, and navigation controls
with shadcn primitives. Keep app-specific schedules and calendar compositions.
Use native file inputs via Input and navigation links via Button asChild.

Consumes: Task 1 Button, Field, Radix Select, Dialog, and feedback interfaces.
Verify: existing UI behavior tests, typecheck, and lint.
Expected: controls preserve selection, form submission, loading, and URLs.

## Task 3: design application

Restyle the home hero, search surfaces, footer, venue cards, authentication,
owner and admin shells. Use dark teal hero and CTA bands, bright green pills,
mint highlights, restrained shadows, and the supplied typography hierarchy.

Consumes: Task 1 tokens and Task 2 compositions.
Verify: real browser desktop and mobile home/search/venue, login, owner calendar,
venue forms, and admin screens. Check overflow, focus, and contrast.
Expected: MongoDB inspired design and usable responsive layouts.

### Additional redesign (user direction, 2026-10-02)

Continue directly on main. Make design choices without further questions.
Polish the home hero with court-line decoration, a floating search panel,
clearer section hierarchy, and more restrained surfaces. Align workspace
navigation and add compact owner/admin utility headers. Use lightweight CSS
page fades, staggered entrances, progressive scroll reveals, button feedback,
and Radix dialog/sheet transitions. Preserve fixed booking actions by keeping
route fades free of transforms. Disable added movement for reduced motion.

Verify the home at desktop and narrow mobile widths, reduced-motion styles,
search navigation, slot selection, dialogs/focus, owner forms, and admin views.

## Task 4: completion

Run typecheck, lint, complete test suite, and production build. Request one
fresh review focused on compatibility regressions, raw controls missed by the
audit, invalid HTML, and mobile layout. Fix material findings and recheck.
Keep the development server running for the user.

Review focus: Slot loading and disabled links; nested Radix triggers; native
select and checkbox form values; dark header contrast; fixed mobile controls;
preservation of all server-side routes and request payloads.

## Completion evidence — 2026-10-02

- Tasks 1–4 are complete on `main`. Registry controls are configured and all
  visible raw buttons, inputs, selects, textareas, and labels now use the shared
  primitives. The remaining native hidden input is for authentication metadata.
- Fresh review findings were resolved: loading links cancel parent handlers,
  mapped action links keep their keys, and calendar arrows use shared buttons.
- Full suite: **51 files, 221 passing tests**. Typecheck and lint pass.
- After the final mobile navigation refinement, all **24 UI tests** pass and
  the production build passes again.
- Production build passes. The existing Prisma/Next file tracing warning remains.
- Browser checks pass for desktop home/workspace layouts and mobile home,
  search, venue selection, owner calendar, court fields, hours, and admin review.
  Search query parameters and sticky booking summaries remain correct.
- Public and owner menus trap focus, close with Escape, and return focus.
- At 320px and 390px, checked pages have no horizontal document overflow.
- Emulated reduced motion disables page/hero/scroll animations and pauses the
  carousel. Dark OS preference still renders the intended white input/canvas.
- Demo stock placeholders render a local court illustration; uploaded images
  retain their original URLs. No API, Prisma schema, or booking logic changed.
- `DESIGN.md` passes structural lint (zero errors); the validator warns about
  three explicit border-color extension tokens, which its alpha schema does not
  yet recognize.
- Euclid Circular A remains a declared preference with system fallbacks because
  no licensed font file was supplied.
- Development preview: `http://localhost:3000`.
- Screenshot follow-up: the owner CTA's Card background overrode the hero's
  teal base with white. Its explicit teal background now overrides the shared
  white Card utility. Browser checks reproduce the original white surface and
  verify the corrected teal surface and readable white text.

## Follow-up verification (2026-10-02)

- Fixed the bottom CTA background: Card's utility background overrode the hero
  component-layer teal. Explicit teal utility restores white-text contrast.
- Redesigned desktop and mobile header with icon navigation and a court-search
  action. Added the footer credit “Powered by Code Box Studios”.
- Replaced native dropdowns with shadcn Radix Select menus across search, owner
  dialogs, venue details, courts, payments, and the development sharing picker.
- A failing selection/form test now passes; the sharing test uses the custom
  menu. Full suite passes 51 files / 221 tests. Typecheck, lint, build pass.
- Browser confirms custom menu, correct CTA contrast, footer credit, and no
  horizontal overflow at 320px; desktop header visually reviewed at 1440px.
