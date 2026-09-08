# RallyPoint — Dev "Share to phone" QR panel (design)

- **Date:** 2026-09-08
- **Status:** Approved (pending spec review)
- **Scope:** Dev-only convenience. No production behaviour changes.
- **Related:** [[rallypoint-thin-slice]] (dev magic-link banner pattern), `src/components/dev/MagicLinkBanner.tsx`, `src/app/api/dev/last-magic-link/route.ts`

## Motivation

Opening the running dev app on a physical phone (same Wi-Fi) currently means:
manually finding the machine's LAN IP, typing it into the phone, and — because
magic-link URLs are built from `APP_URL` (`http://localhost:3000`) — being
unable to log in on the phone unless `APP_URL` is edited by hand. The LAN IP is
also not obvious: this machine exposes both a real Wi-Fi interface
(`172.16.14.20`) and a WSL virtual interface (`172.26.48.1`), and DHCP can
change the Wi-Fi address over time.

Goal: a dev-only in-app panel with a button that reveals a QR code encoding the
correct LAN URL. Scan it with the phone camera and the app opens. Logging in on
the phone then works without manual `APP_URL` edits.

## Goals

- A dev-only floating panel/button ("Share to phone") beside the existing
  magic-link banner.
- On click: detect the current LAN IPv4 (skipping virtual/WSL/link-local
  interfaces), combine with the dev server's port, render a scannable QR of
  `http://<lan-ip>:<port>` plus the URL text and a copy button.
- A close/hide control (the "stop" half — there is no process to kill; Start/Stop
  means reveal/hide the panel).
- Magic-link login works from the phone with no manual configuration.

## Non-goals (YAGNI)

- No tunnel / public internet exposure (chosen: same-Wi-Fi only). No cloudflared
  or ngrok, no child-process management.
- No auto-login QR (chosen: QR opens the plain home page; log in normally on the
  phone).
- No production code paths. The panel and route must be inert in production.
- No fix for Windows Firewall prompts (outside app scope) — documented as a
  manual one-time "Allow access" step.

## Design

### 1. LAN address detection — `src/lib/dev/lan-address.ts`

Pure, unit-testable helper. Input: the object returned by Node
`os.networkInterfaces()` and the request's port. Output: a chosen URL plus any
alternates.

```
export interface LanCandidate { iface: string; address: string; url: string }
export function pickLanAddresses(
  ifaces: Record<string, os.NetworkInterfaceInfo[] | undefined>,
  port: string,
): { chosen: LanCandidate | null; candidates: LanCandidate[] }

// Also here (same module — both parse network/host input for the share route):
export function portFromHost(host: string | null, fallback?: string): string
```

`portFromHost` extracts the port from a `Host` header value (e.g.
`"172.16.14.20:3000"` → `"3000"`, `"localhost"` → fallback `"3000"`).

Selection rules:
- Keep only `family === "IPv4"` && `internal === false`.
- Drop link-local `169.254.*`.
- Drop interfaces whose name matches virtual patterns (case-insensitive):
  `vEthernet`, `WSL`, `Hyper-V`, `VirtualBox`, `VMware`, `Loopback`, `Docker`.
- Rank remaining: names containing `Wi-Fi`/`Wireless`/`WLAN` first, then
  `Ethernet`, then the rest. `chosen` = top-ranked; `candidates` = all kept
  (so the panel can offer a picker when more than one survives).

### 2. Dev API route — `src/app/api/dev/share-url/route.ts`

`GET`. Mirrors `last-magic-link/route.ts` conventions.

- If `process.env.NODE_ENV === "production"` → `404` (never active in prod).
- Read port from the request `Host` header (falls back to `3000` if absent), so
  the URL is correct even when dev runs on another port.
- Call `pickLanAddresses(os.networkInterfaces(), port)`.
- If `chosen` is null → return `{ url: null, qrDataUrl: null, candidates: [],
  error: "no LAN interface found" }` (panel shows a friendly "not on a network"
  message).
- Generate a QR PNG data URL with the `qrcode` package (`QRCode.toDataURL`) for
  **every** candidate's `url` (at most a handful of interfaces — cheap).
- Return `{ url, qrDataUrl, candidates }` where `candidates` is
  `Array<{ iface, address, url, qrDataUrl }>` and top-level `url`/`qrDataUrl` are
  the `chosen` default. Switching interface in the panel is therefore a pure
  client re-render from `candidates` — no second request.

### 3. Dev panel — `src/components/dev/ShareToPhonePanel.tsx`

Client component, guarded exactly like `MagicLinkBanner`
(`if (process.env.NODE_ENV === "production") return null`). Rendered in the same
place the banner is mounted.

- Collapsed state: a small floating button labelled "📱 Share to phone".
- On click: `GET /api/dev/share-url`, then expand to show the QR
  (`<img src={qrDataUrl} />`), the URL text, a **Copy** button, and — only if
  `candidates.length > 1` — a small dropdown to switch interface (re-renders the
  QR/URL from the returned `candidates`, no second request).
- A ✕ collapses back to the button. No polling (unlike the banner): the QR is
  fetched on demand each time it is opened, so a changed IP is always current.

### 4. Phone-login fix — dev-only magic-link base

Problem: `requestMagicLink` builds the link from `APP_URL`
(`src/lib/auth/magic-link.ts:35`). Requested from the phone, the link would point
at `http://localhost:3000` — the phone itself — and fail.

Change (dev-only, prod unchanged):
- `requestMagicLink(emailRaw: string, opts?: { origin?: string })`.
- Exported pure helper `resolveMagicLinkBase(origin?: string): string` is the
  single source of truth for the environment branch:
  - Production (`NODE_ENV === "production"`): `process.env.APP_URL ?? "http://localhost:3000"` (identical to today — origin ignored).
  - Otherwise (dev/test): `origin ?? process.env.APP_URL ?? "http://localhost:3000"`.
- Caller `src/app/api/auth/request/route.ts` **always** passes the request origin
  (`req.nextUrl.origin`); `resolveMagicLinkBase` decides whether to honor it, so
  production can never be redirected by an attacker-supplied host. No separate
  request-origin helper is needed.

### 5. Dependency

Add `qrcode` (+ `@types/qrcode`) as **devDependencies**. QR generation happens
server-side in the dev route, so nothing is added to the production client
bundle.

## Data flow

Desktop opens panel → `GET /api/dev/share-url` → server picks LAN IP (`os`
interfaces) + port (`Host` header) → generates QR → panel renders QR + URL →
scan on phone → phone opens `http://<lan-ip>:<port>` → request magic link on
phone → `POST /api/auth/request` passes `req.nextUrl.origin` → link base = phone's
host → magic-link banner "Open link" resolves on the phone → signed in.

## Error handling

- Route 404s in production (defense-in-depth alongside the component guard).
- No usable LAN interface → structured `{ url: null, error }`; panel shows a
  short "You don't appear to be on a Wi-Fi/LAN network" note instead of a QR.
- QR generation failure → route returns `500` via the existing error pattern;
  panel shows a retry.
- Firewall: if the phone can't reach the URL, the panel shows a one-line hint to
  allow Node through Windows Defender Firewall on Private networks (the common
  first-time blocker). Purely informational.

## Security / safety

- Both the route and the panel are hard-gated to non-production.
- The route exposes only the machine's own LAN IP + port — no secrets, no tokens
  (QR is the plain home URL, not a magic link).
- The dev-origin magic-link base is dev-only; production continues to trust only
  `APP_URL`, so an attacker-supplied `Host` header can never redirect a
  production magic link.

## Testing

Unit tests (Vitest), matching the existing `tests/` layout:
- `pickLanAddresses`: given fake `networkInterfaces()` output containing a WSL
  `vEthernet` entry, a `169.254.*` link-local, `127.0.0.1`, and a `Wi-Fi`
  interface → asserts it picks the Wi-Fi one, ranks it first, and omits the
  virtual/link-local/internal entries; empty/none-found → `chosen: null`.
- `resolveMagicLinkBase`: dev + provided origin → uses the origin; dev + no
  origin → falls back to `APP_URL`; production → ignores origin and uses
  `APP_URL`. Also `portFromHost`: `"ip:3000"` → `"3000"`, `"localhost"` →
  fallback. Extends `tests/auth/magic-link.test.ts`, adds `tests/dev/`.

The route and panel are thin dev-only glue over the tested helpers and are not
unit-tested; verified manually (open panel → scan on phone → log in).

## Manual verification

1. `npm run dev`, open the app on desktop, click "📱 Share to phone".
2. Scan the QR on a phone on the same Wi-Fi → app home loads.
3. Request a magic link on the phone → tap "Open link" in the banner → signed in.
4. Confirm the panel/route return nothing in a production build
   (`NODE_ENV=production`).
