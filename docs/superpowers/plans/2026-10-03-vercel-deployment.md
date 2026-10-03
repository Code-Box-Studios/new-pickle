# Vercel Production Deployment Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Work directly
> on main; the user has authorized deployment and requested no further choices.

**Goal:** Publish Pikol on Vercel with the supplied Supabase project.

**Architecture:** Vercel hosts Next.js pages and server routes. Prisma and
Payload use Supabase PostgreSQL; Supabase Auth and private Storage are already
integrated. No separate Render service is required for the current app.

**Tech Stack:** Next.js 16, Vercel CLI, Supabase, Prisma 5, Payload 3, Node 22+.

**Spec:** docs/deployment/supabase.md

## Interim preview requested by the user

The user requested publishing with the supplied public Supabase URL/key for now.
Use explicit `APP_PREVIEW_MODE=true` for this interim deployment. Default site
content and the national city catalog must load without PostgreSQL. Accounts,
bookings, CMS operations, and media reads must not perform private database
operations or send authentication messages in preview mode. Display clear
coming-soon states; never insert fake venues or grant temporary user roles.
Supabase SSR refresh remains integrated. Full production setup below stays
pending until the private service connections are available.

- [x] Add preview guards and coming-soon UI; verify regression tests fail first.
- [x] Run the suite and a build without database environment variables.
- [x] Review and commit on main; set the production preview flag and publish.
- [x] Check public pages, protected routes, and unavailable API responses live.

## Global constraints

- Preserve the user's ignore files and pnpm lockfile; use the npm lockfile for deployment.
- Exclude local environment files, uploads, and generated build artifacts from source uploads.
- Never publish loopback database URLs or expose private credentials in logs.
- Apply database/CMS migrations separately from frontend builds; do not seed demo accounts.
- Preserve existing hosted data and use the canonical production URL for Auth.

## Review focus

- Fresh builds must generate the ignored Prisma client before compiling Next.js.
- Mixed local lockfiles must not change the cloud package manager unexpectedly.
- Database credentials must point to Supabase, with Payload using session/direct mode.
- Auth callbacks must use the deployed canonical domain and approved redirects.
- Uploads and authenticated booking/CMS access must work after deployment.

## Task 1: Prepare a reproducible deployment

**Files:** vercel.json, .vercelignore, docs/deployment/supabase.md.

- [x] Set the Next.js framework, npm CI install, and Prisma generation before build.
- [x] Exclude local secrets, uploads, tooling caches, tests, and deployment-local state.
- [x] Validate the Vercel configuration and run its exact build command locally.

## Task 2: Connect services and publish

- [x] Authenticate Vercel and access the intended project/team.
- [ ] Obtain hosted PostgreSQL URLs and the private Storage key through connected accounts or ignored local configuration.
- [x] Inspect hosted data before applying migrations; preserve any existing app data.
- [x] Apply Prisma/CMS migrations and run supabase/setup.sql.
- [ ] Verify migrations through the native CLIs and seed missing CMS content.
- [ ] Configure canonical APP_URL, Auth redirects/templates, and email/SMS providers.
- [ ] Set Vercel production environment variables securely and deploy.
- [ ] Verify the live home/search/auth pages, manifest, uploads, bookings, and CMS permissions.

## Deployment ledger

- Vercel CLI is authenticated to Code Box Studios. Project `pikol` is linked
  (`prj_MGRqoSZs8XhokzLsliOWVcbDHCaS`). Its assigned production domain is
  `pikol-delta.vercel.app`; the successful preview deployment is recorded below.
- Remote project settings are Next.js, Node 24, `npm ci`, and
  `npm run db:generate && npm run build`. Both the exact build command and
  `vercel build --yes --prod` completed successfully. The local build used
  development credentials and must not be published as a prebuilt deployment.
- Supabase MCP can access `bulxmjdxoophdskdpyhg`. Vercel MCP cannot access the
  intended team, so deployment uses the authenticated Vercel CLI.
- The hosted application schemas were empty before setup. Applied all ten
  committed Prisma migrations and both Payload migrations through Supabase
  migration operations. Native migration history records include the actual
  Prisma file checksums and Payload migration names.
- Verified ten Prisma history entries, two CMS history entries, the booking
  overlap exclusion constraint, and RLS on all eighteen public tables.
- The `pikol-uploads` bucket is private with a 4 MiB limit. `btree_gist` lives in
  `extensions`; anonymous clients cannot execute the internal RLS helper.
  Supabase's security advisor reports no warnings or errors. Its informational
  notices about tables without policies are expected for backend-only access.
- Public Supabase settings are in ignored `.env.local`. Hosted `DATABASE_URL`,
  `DIRECT_URL`, and `SUPABASE_SECRET_KEY` are still required for the full app.
  `CMS_DATABASE_URL` can use `DIRECT_URL`.
- CMS content seeding, Auth project configuration, full app enablement, and
  live authenticated/upload checks remain pending. No demo accounts or venues
  were inserted, and no email or SMS was sent.
- Configured Vercel production `APP_URL=https://pikol-delta.vercel.app`, both
  public Supabase settings, the Storage bucket, and a generated private Payload
  secret. Database connection URLs and the Storage secret are still absent.
- Deployment review found that 5 MiB form uploads would exceed Vercel's 4.5 MB
  request limit. Reduced the app/bucket limit to 4 MiB and added immediate form
  feedback. Regression tests failed against the previous behavior, then all ten
  targeted storage/form tests passed after the fix.
- All 304 tests across 73 files passed using the dedicated local test database.
  The follow-up review found no remaining material upload issues. Added
  `.vercel/**` to ESLint's generated-output ignores after the local Vercel build
  exposed generated launchers and bundles to repository linting.
- TypeScript, repository lint, and the exact production build command passed
  after the upload fix. The build retains the two existing Prisma filesystem
  tracing warnings. Reconfirmed that all ten hosted Prisma checksums match the
  committed migration files. No production runtime or private upload has been
  exercised while the required credentials are missing.
- Confirmed the user's failed Git deployment was blocked by missing
  `DATABASE_URL` during home-page prerendering, with Payload also attempting
  its local fallback. The failure is unrelated to package installation.
- Ruling: publish an explicit temporary preview using public Supabase settings
  after the user said "just use this for now". This avoids inventing private
  credentials; accounts, bookings, CMS, and uploads remain unavailable until
  the full service configuration is completed.
- Preview regression tests failed against the original public/CMS/auth paths,
  then passed after adding explicit guards. A production build with empty
  database and Storage credentials passed. The original two Prisma tracing
  warnings remain; no database connection was needed for this build.
- Final review found admin pages and the CMS not-found boundary could access
  private services alongside redirecting layouts. Added guards at those entry
  points. All three new regression cases failed first, then passed; normal CMS
  not-found behavior remains covered with preview disabled. No deferred minors.
- After the review fixes, all 317 tests across 76 files, TypeScript, and lint
  passed. Vercel Production now has `APP_PREVIEW_MODE=true`. A dry source upload
  excludes all environment files, private deployment state, upload contents,
  tests, and local graph caches; only empty directory entries remain.
- Committed preview implementation directly on main as `8b99547`. Published
  fresh source through the scoped Vercel CLI; deployment
  `dpl_3PrURZpkm1SdHsKuHEZDT5NQJqoG` is Ready and aliased to
  `https://pikol-delta.vercel.app`. The cloud's npm install, Prisma generation,
  and production build succeeded without database environment variables.
- Live home/search/login/signup/venue-onboarding pages, the manifest, and
  service worker return successfully. Account pages show coming-soon notices.
  CMS API methods and media reads return 503; booking/owner/admin/proof APIs
  require authentication; verification redirects to the unavailable notice.
  No authentication message or data insertion was performed.
- Real Chrome checks passed at 390px and 1440px without horizontal overflow.
  The city picker selected Cebu City; the calendar selected October 5; search
  retained those values and displayed the preview notice. City/date popovers
  stayed within the mobile viewport. Bookings, admin, and owner pages redirected
  to sign-in in the browser (Next streaming redirects can begin with HTTP 200).
  Sign-up renders its notice on mobile. Service worker control was observed.
- README now links the live preview and distinguishes its available website
  features from the pending private service configuration. User ignore files
  and the pnpm lockfile remain untouched and excluded from these commits.
