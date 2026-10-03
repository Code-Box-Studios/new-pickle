# Deploy Pikol with Supabase

Pikol uses Supabase **PostgreSQL, Auth, and private Storage**. Prisma retains the
booking engine and overlap constraint; Payload retains the `cms` schema. The
Next.js app still needs hosting. Supabase Auth is integrated through server
routes with HttpOnly SSR cookies and Next.js 16 `proxy.ts` session refresh.

## Temporary public preview

To publish the website before private service credentials are available, set
`APP_PREVIEW_MODE=true` in Vercel's Production environment, along with `APP_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The
Supabase packages and session helpers are already installed and integrated.

This explicit mode uses the default website content and all 149 Philippine
cities without a PostgreSQL connection. Accounts and court bookings display
coming-soon states. Private pages redirect to sign-in; CMS operations, media
reads, and authentication requests are unavailable. It does not send email/SMS,
insert demo venues, or open database policies. This is a website preview.

Complete the service configuration below, then set `APP_PREVIEW_MODE=false`
and redeploy to enable the full app. Keep the flag false for local development.

## 1. Configure database connections

In Supabase **Connect**, copy the PostgreSQL connection strings and supply your
database password. URL-encode special characters in the password. Keep them
in `.env.local` and the hosting provider's private environment settings.

- `DATABASE_URL`: Prisma runtime connection. Use Supavisor **transaction** mode
  on port **6543** for serverless hosting; add `pgbouncer=true&connection_limit=1`
  and `schema=public` to the query string. A session/direct connection also works
  for a persistent Node server.
- `DIRECT_URL`: migrations use the direct connection, or Supavisor **session**
  mode on port **5432** when your host needs IPv4. Never use transaction mode
  for migrations.
- `CMS_DATABASE_URL`: use session mode on **5432** or a direct connection. Payload
  must not use the Prisma transaction-pool URL. Defaults to `DIRECT_URL`.
- `TEST_DATABASE_URL`: keep this pointing at the dedicated **local test database**.
  The test harness pins both runtime and migration URLs to it. Never point it
  at the hosted app database; tests truncate application data.

Set `APP_URL` to the public website origin and generate a stable `PAYLOAD_SECRET`.
The project URL and publishable key provided for this session are already in
ignored `.env.local`; the publishable key is not a PostgreSQL password.

### Empty hosted database

```bash
npm install
npm run db:generate
npm run db:deploy
npm run cms:migrate
npm run cms:seed
```

Run `supabase/setup.sql` in the Supabase SQL editor after those migrations.
Disable the Supabase **Data API** for this project if it is not used elsewhere.
Application tables have RLS enabled with no browser policies. Pikol reads and
writes through Prisma/Payload using the trusted database connection. Keep `cms`
out of exposed Data API schemas; never add broad anonymous CRUD policies.

### Dedicated production server login

For an already migrated database, [`supabase/runtime-access.sql`](../../supabase/runtime-access.sql)
creates the `pikol_server` role with access only to the application's `public`
and `cms` tables. Its policies target that server role only; browser roles remain
blocked. It cannot create databases, manage roles, or bypass RLS. Migration
metadata is read-only. Run this setup once as the database administrator, then
set a strong, generated login password through a private administration session.
Never commit a password to a SQL migration or put it in a public environment variable.

Use `pikol_server.PROJECT_REF` as the Supavisor username for the hosting provider's
runtime connections. Keep an administrator connection separately for migrations;
the restricted runtime `DIRECT_URL` does not have migration privileges. Revisit
grants and policies when migrations introduce new tables.

The production CMS connection uses `sslmode=verify-full` and
`sslrootcert=supabase/prod-ca-2021.crt`. The public Supabase root CA is bundled
through Next.js file tracing so serverless functions can validate the database
certificate. When Supabase rotates its CA, download the replacement from
Database Settings, update the bundled certificate, and redeploy.

### Existing application data

Before changing connection strings, back up the old database and `uploads/`.
Stop writes during the transfer. Use PostgreSQL `pg_dump` / `pg_restore` to
transfer only the application's **public** and **cms** schemas into the empty
Supabase project, preserving `_prisma_migrations` and Payload's migration
records. Do not dump or overwrite Supabase's managed `auth`, `storage`, or
other platform schemas. Ensure `btree_gist` is available for the restored
booking exclusion constraint. Verify table counts and the constraint after
restoration, then apply the new committed migrations and `supabase/setup.sql`.

Keep existing user IDs and relations. On first verified Supabase sign-in,
Pikol links an existing email or verified mobile account to `users.supabaseId`.
Conflicting accounts are rejected for manual review. Previous Pikol session
cookies and magic links no longer authenticate, so players sign in again.

Transfer existing `uploads/payment-proofs` and `uploads/venue-media` files into
`pikol-uploads` with **the same object keys**, using the private server key.
Keep the original local files until hosted reads and authorization checks pass.

## 2. Configure email authentication

In Supabase **Authentication**:

1. Enable Email and allow new sign-ups.
2. Set the **Site URL** to `APP_URL`.
3. Allow `http://localhost:3000/auth/verify**` for local work and
   `https://YOUR-DOMAIN/auth/verify**` for production. Add a LAN origin only if
   testing sign-in from a phone on your network.
4. Set the **Magic Link** and **Confirm signup** email templates to the contents
   of [`supabase/templates/magic-link.html`](../../supabase/templates/magic-link.html).
   The `RedirectTo` always includes a `next` query parameter; the template adds
   `token_hash` and `type=email`. The server verifies the token and retains the
   booking return path. The default implicit-flow confirmation template does
   not establish this app's server session.
5. Configure custom SMTP (for example Resend) to send to real users. Supabase's
   default sender is for testing and restricts recipients to your project team;
   it currently allows only two messages per hour.

Email templates and SMTP are project settings, not environment variables in
Pikol. The app no longer sends its own development links. Local Supabase with
its email inbox is another development option; set this app's Supabase URL/key
and PostgreSQL URLs to that local stack, and use the same token-hash template.

## 3. Configure phone OTP

Enable **Phone** in Authentication and configure an SMS provider there (Twilio,
Vonage, MessageBird, or another supported provider). Set six-digit codes and
an expiry of at most **600 seconds**. Supabase handles delivery and verification;
Pikol adds a one-minute resend cooldown, five sends/hour per number, five
verification attempts, a ten-minute upper bound, and replay protection. It also
limits sends across numbers to 20/hour. Requests share that application budget
unless a trusted reverse proxy supplies a verified client IP.

To give each client IP a separate budget, configure `PHONE_AUTH_PROXY_SECRET`
on Pikol and the reverse proxy. The proxy must overwrite `x-real-ip` and
`x-rallypoint-proxy-secret` with the real client IP and shared secret. Never
expose the secret to the browser. Arbitrary forwarded headers cannot change the
budget. Without this optional setup, email works normally and phone requests
use the shared limit. Configure Supabase's own Auth rate limits as well.

Phone OTP requires a paid SMS provider. Use Supabase's dashboard test phone
numbers and codes during development. No SMS credentials belong in Pikol's
browser or `.env`; no local codes are displayed by the app. The old Twilio Verify
delivery variables are no longer used.

## 4. Configure uploads

Set the server-only `SUPABASE_SECRET_KEY` from Supabase's API keys page (legacy
`SUPABASE_SERVICE_ROLE_KEY` is also accepted). Never expose it with `NEXT_PUBLIC_`.
Set `SUPABASE_STORAGE_BUCKET=pikol-uploads`. The SQL setup creates a private
bucket with a 4 MiB limit for JPEG/PNG/WebP. Payment proofs and venue drafts
remain private; the existing Pikol routes decide who may view each object.

Local filesystem storage is available only when explicitly setting
`STORAGE_PROVIDER=local` in a non-production environment. Production uses
Supabase Storage and does not fall back to an ephemeral local filesystem.

## 5. Create the first admin

Sign up through Pikol with a deliverable email, click the verification link,
then promote that application user in the SQL editor:

```sql
UPDATE public.users SET role = 'ADMIN' WHERE email = 'YOUR_VERIFIED_EMAIL';
```

Open `/admin` or `/cms`. Roles and active status come from Pikol's database on
subsequent requests. Supabase user metadata cannot grant owner/admin privileges.
Do not run `db:seed` on production: it inserts demo accounts and venues.

## 6. Deploy and verify

Set these environment variables on the host that runs Next.js:

```text
APP_URL
DATABASE_URL
DIRECT_URL
CMS_DATABASE_URL
PAYLOAD_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_STORAGE_BUCKET
```

Use Node **22 or newer** (24 is used in development). Build with
`npm run db:generate && npm run build`, then use `npm start` for a
Node host. Run migrations as a separate deployment step before serving traffic.
On Vercel, this current repository deploys the Next.js frontend and its server
routes together; a separate Render backend requires an additional API split.
Supabase replaces the database/auth/storage services, not Next.js hosting.

### Vercel project settings

The repository includes `vercel.json`: Next.js, `npm ci`, and
`npm run db:generate && npm run build`. Prisma's generated client is ignored by
Git, so generation must happen before every fresh cloud build. `.vercelignore`
keeps local environment files, uploads, and tooling caches out of CLI source
uploads. Set production values in Vercel's environment settings; do not upload
your development `.env` or use its loopback database URLs.

Functions are configured for Seoul (`icn1`) alongside this project's Supabase
database in `ap-northeast-2`. If changing the database region, choose the nearest
[Vercel function region](https://vercel.com/docs/regions) in `vercel.json` before
deploying. Public CMS copy has a five-minute cache with immediate invalidation
for CMS edits; auth and ownership checks remain request scoped.

Uploads are limited to 4 MiB in both forms and storage validation. This leaves
room for multipart fields within Vercel's
[4.5 MB request limit](https://vercel.com/docs/functions/limitations#request-body-size).

Select Node 24 in the project's settings (Node 22 is also supported). Link the
intended Vercel account/project, configure the production environment variables
above, apply the database setup separately, and publish:

```bash
npx vercel login
npx vercel link
npx vercel deploy --prod
```

After project linking, set `APP_URL` to its assigned production domain (or the
custom domain), and set Supabase's Site URL/redirects to the same origin before
deploying. Keep those values on the stable production domain rather than an
individual deployment URL. Use a separate Supabase project for previews that
need data; do not point untrusted previews at the production database.

Verify sign-up, email sign-in, SMS test sign-in, session refresh, logout,
booking ownership, owner promotion, CMS edits, image uploads, and denied proof
access from another account. Check RLS: the public publishable key must not be
able to read application tables. Keep auth responses and refreshed cookies out
of CDN caches.

## References

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Prisma connection guidance](https://supabase.com/docs/guides/database/prisma)
- [Database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
