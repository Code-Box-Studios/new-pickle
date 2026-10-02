# Payload content editing

## Objective
Let RallyPoint administrators edit marketing content in Payload at `/cms`. Keep the current MongoDB inspired design and shadcn application controls. Work directly on `main`, as requested; implement autonomously.

## Design
Use Payload 3.90.2, with Next 16.3.8 and React 19.2.4; these versions satisfy published peer ranges and include current framework fixes. Use the official Payload Next admin and REST integration, with a separate root layout so Payload styles and application providers remain isolated. Move the three existing application route groups beneath `(frontend)` without changing their URLs. Payload routes live beneath `(payload)`: admin `/cms`, REST `/api/cms`.

Use the existing Postgres database in a separate `cms` schema, with explicit committed Payload migrations and development push disabled. Prisma continues to own `public`. Separate CMS users are bookkeeping records linked to existing RallyPoint users; the existing signed session and a current database ADMIN role grant CMS access. Disable Payload password registration/login and prohibit public creation or changes to CMS users. Anonymous admin visitors go to `/login?next=/cms`; non-admin sessions cannot open the editor. Preserve a validated internal destination through the magic link flow. Reject external, protocol-relative, and backslash destinations.

Three globals: Homepage (hero copy, CTA labels/links, trust labels, popular venue section, three how-it-works steps, owner CTA); Site settings (header labels, tagline, footer copy/links, studio credit); Venue landing (hero copy, sign-in/create labels, three benefits). Each supports drafts and retained versions. Public pages use the server-only local API with `draft: false` and a verified `_status: published`; no public REST access to content or users. Local readers use current published content per request; absent configuration or a CMS outage falls back to the current copy so booking remains usable. Content loads have a 2-second deadline; database connection/query timeouts are 1.5 seconds. Content errors are logged. Seeding checks both main documents and versions, creates only missing globals with published status, and never overwrites saved content.

Marketing links accept internal paths, anchors, or HTTPS URLs; no script schemes. Keep actual venue data, availability, pricing, booking, payment, and operational UI in Prisma and existing workflows. Header and footer retain the requested Code Box Studios credit. Payload's built-in admin controls belong to the editor; application dropdowns use shadcn Radix Select, including owner dialogs.

## Acceptance
- Administrator reaches `/cms` from application navigation without a second login.
- Anonymous visitors redirect to login; owners/customers and revoked admins cannot access CMS content or user endpoints.
- Saving a draft leaves the public homepage unchanged; publishing and refreshing displays the new copy.
- Existing routes and booking tests pass after root layout isolation; mobile public/header/dropdown layouts do not overflow.
- CMS schema migrations, repeatable seed command, environment setup, and editor instructions are documented.
- No secrets committed. Changes committed on main without pushing.
