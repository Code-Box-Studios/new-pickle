# Phone sign-in and installable website

User requests phone sign-in, full responsiveness, and installation on phones.
Work directly on main and proceed autonomously, preserving existing email login.

Phone sign-in uses Philippine mobile normalization and a six-digit verification
code. New phone accounts have no fabricated email. A separate verified mobile
identity prevents an editable booking contact from granting account access.
Codes expire after ten minutes, allow five attempts, and are single-use. Resends
have a 60-second cooldown and bounded hourly delivery. Development exposes its
code only in the requester's development response. Production uses Twilio Verify
with environment credentials and never accepts development challenges.

PWA uses a manifest, branded PNG icons, standalone launch, and an install action
with iPhone instructions. Its service worker caches only the static offline
screen and brand assets; booking, authentication, CMS, and other dynamic pages
stay on the network. Offline navigation shows an honest reconnect screen.
HTTPS is required outside localhost. No offline booking or push messaging.

Retain CMS copy, email roles and redirects, booking authorization, keyboard
controls, reduced motion, and 320px layouts. Verify actual phone login, unchanged
email login, request throttling, replay/expiry, session claims, app installability,
offline fallback, and representative mobile public and management screens.
