# Supabase migration

## Intent and scope

Use Supabase PostgreSQL and Supabase Auth for Pikol. Preserve the existing
passwordless email and Philippine phone flows, booking ownership, owner/admin
roles, Payload editor, and database overlap protection. Work directly on main
and proceed without additional questions, as requested by the user.

## Architecture

- Prisma continues to own the public application tables. Supabase provides
  PostgreSQL; runtime and migration connections are configured separately.
- Add a nullable unique `users.supabaseId`. Existing application IDs and all
  relationships remain intact. Bind only verified Supabase identities; never
  use editable user metadata for roles or treat booking contact numbers as
  verified login identities. Conflicting existing identities require support
  instead of merging accounts automatically.
- Supabase SSR cookies replace the old Pikol JWT. Verify users through the Auth
  server and read the current application role and active state on each request.
  A Next.js proxy refreshes sessions and forwards cookie/cache headers. Cookies
  remain HttpOnly; authentication is performed through Pikol's server routes.
- Email requests use Supabase OTP magic links. The email template sends a token
  hash to `/auth/verify`; allowlisted destinations retain booking return paths.
  Phone requests use Supabase OTP with the existing local challenge tracking
  for resend limits, attempt limits, expiry, and replay protection.
- Payload's custom strategy verifies the same Supabase session and live admin
  role. Owner promotion no longer needs to mint a session with a new role.
- Supabase Storage provides persistent uploads using a private bucket and a
  server-only secret key. Existing authorized media/proof routes remain the
  access boundary. Explicit local storage remains available for local tests.
- Enable RLS without browser policies on application tables. Backend database
  credentials perform all database operations. Keep the CMS schema out of the
  Supabase Data API and document disabling the Data API for this server app.

## Migration and configuration

The user supplied the project URL and publishable key, saved in ignored
`.env.local`. Supabase MCP is added and OAuth authentication succeeded. The
private database connection strings and storage secret are still absent.
Implement and verify the integration locally; do not invent credentials or
claim a hosted database was migrated. Document connection strings, migrations, email
templates, SMTP, SMS provider, private uploads, existing-data transfer, and
owner/admin account setup. Remove custom auth fallback and development links;
Supabase configuration is required to sign in in every environment.

## Verification

Exercise identity binding and collisions, inactive accounts, live role changes,
forged/revoked sessions, email redirects, SMS limits and replay, refreshed and
logged-out cookies, Payload access, storage errors, and RLS denial. Run the
full existing database-backed suite, typecheck, lint, and production build.
Hosted delivery and migration require the user's Supabase project settings.
