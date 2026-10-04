# Venue workspace sign-in security

## Intent

Venue owners manage reservations, payment instructions and public listings. They
need stronger account protection than a player browsing and booking courts.
The user requested more secure owner sign-in, while retaining the existing
Supabase integration and working directly on main without repeated approval prompts.

## Design

- Add `/owner/login` as the owner entry and `/owner/verify` for authenticator
  setup and verification, outside the protected workspace layout.
- Keep the existing email link and phone OTP first factors. An owner, staff
  member or administrator must also verify a TOTP authenticator before the
  application exposes an authenticated session to protected pages or APIs.
- Keep `getUser()` verification and live database role/active status checks.
  Require `aal2`, a TOTP method in the verified session, and a currently verified
  TOTP factor. Missing factors, failed assurance checks and stale tokens deny access.
- A separate first-factor session helper is available only for login routing
  and the MFA endpoint. It grants no access to venue or booking data.
- Preserve HttpOnly cookies. MFA enrollment and challenge/verification run in a
  same-origin server API using the publishable key. Never return access or refresh
  tokens to JavaScript. All MFA responses are private and non-cacheable.
- First-time owners explicitly start setup, scan a QR or enter a manual key,
  then confirm a six-digit code. Existing factors get a verification form and a
  selector if there is more than one authenticator. Never delete a verified factor
  or allow an AAL1 session to replace one.
- Preserve local return paths, including the venue setup path after promotion
  from CUSTOMER. Existing customers keep their current sign-in experience.

## Recovery and rollout

Existing owners must set up an authenticator on their next workspace visit.
Do not enroll factors on existing users during deployment. Lost authenticators
require an operator to independently verify the owner's identity and reset the
factor through Supabase administration; an email link alone cannot bypass MFA.
Document this operator responsibility before launch. No schema migration is needed.

## Verification

Test first-factor denial for every privileged role, successful TOTP access,
revocation, stale/deleted factors, provider errors, role spoofing, direct owner API
denial, same-origin enforcement, setup/verification errors, cookie handling,
safe redirects and customer regression. Check the new forms at mobile and desktop
widths and run TypeScript, ESLint and the complete suite before deployment.
