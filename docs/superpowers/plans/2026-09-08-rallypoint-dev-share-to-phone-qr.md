# Dev "Share to phone" QR panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dev-only in-app panel with a button that reveals a scannable QR code of the machine's LAN URL, so a phone on the same Wi-Fi can open the running dev app — and can also log in, because dev magic links are built from the request origin.

**Architecture:** A dev-only `GET /api/dev/share-url` route detects the host's LAN IPv4 (via Node `os.networkInterfaces()`, skipping WSL/virtual/link-local interfaces), reads the port from the request `Host` header, and returns a QR data-URL per candidate interface. A dev-only client panel (sibling of `MagicLinkBanner`) fetches that route on demand and renders the QR. A one-line change to the magic-link base resolution makes phone login work. All new surfaces are hard-gated to non-production.

**Tech Stack:** Next.js 16 (App Router, Node runtime route handlers), React 19, TypeScript, Vitest 5 + @testing-library/react (jsdom), `qrcode` (new devDependency), Tailwind v4.

Spec: `docs/superpowers/specs/2026-09-08-rallypoint-dev-share-to-phone-qr-design.md`

## Global Constraints

- **Dev-only, prod-inert:** every new route/component must no-op in production. The route returns `404` when `process.env.NODE_ENV === "production"`; the panel returns `null` in production. Copy the exact guard already used in `src/app/api/dev/last-magic-link/route.ts` and `src/components/dev/MagicLinkBanner.tsx`.
- **No production behaviour change:** the production magic-link base must stay exactly `process.env.APP_URL ?? "http://localhost:3000"`.
- **`qrcode` is a devDependency only** — QR generation happens server-side in the dev route; nothing QR-related ships to the production client bundle.
- **Same-Wi-Fi scope only:** no tunnel, no cloudflared/ngrok, no child-process management, no auto-login QR. (YAGNI — do not add these.)
- **Follow existing patterns:** `@/`-alias imports, `errorResponse` from `@/lib/http` for thrown errors, Node route handlers, Tailwind utility classes matching `MagicLinkBanner`.
- **Commits are local; do NOT push.** End each commit message with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Test runner:** `npm run test` (=`vitest run`); a single file: `npx vitest run <path>`. Full gate before finishing: `npm run typecheck`, `npm run lint`, `npm run test`.

---

### Task 1: LAN address + port helpers

Pure, dependency-free functions that decide which network interface to advertise and how to read the port. No `os` or Next imports here — the caller passes data in, so this is fully unit-testable.

**Files:**
- Create: `src/lib/dev/lan-address.ts`
- Test: `tests/dev/lan-address.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `interface LanCandidate { iface: string; address: string; url: string }`
  - `pickLanAddresses(ifaces: Record<string, import("node:os").NetworkInterfaceInfo[] | undefined>, port: string): { chosen: LanCandidate | null; candidates: LanCandidate[] }`
  - `portFromHost(host: string | null, fallback?: string): string`

- [ ] **Step 1: Write the failing test**

Create `tests/dev/lan-address.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickLanAddresses, portFromHost } from "@/lib/dev/lan-address";
import type { NetworkInterfaceInfo } from "node:os";

// Minimal factory for a network interface entry.
function ip(address: string, extra: Partial<NetworkInterfaceInfo> = {}): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal: false,
    cidr: `${address}/24`,
    ...extra,
  } as NetworkInterfaceInfo;
}

describe("pickLanAddresses", () => {
  it("picks the Wi-Fi IPv4 and skips virtual, loopback and link-local", () => {
    const ifaces = {
      "Loopback Pseudo-Interface 1": [ip("127.0.0.1", { internal: true })],
      "vEthernet (WSL)": [ip("172.26.48.1")],
      "Wi-Fi": [ip("172.16.14.20"), ip("fe80::1", { family: "IPv6" } as Partial<NetworkInterfaceInfo>)],
      "Ethernet 2": [ip("169.254.10.10")],
    };
    const { chosen, candidates } = pickLanAddresses(ifaces, "3000");
    expect(chosen).toEqual({ iface: "Wi-Fi", address: "172.16.14.20", url: "http://172.16.14.20:3000" });
    // only the real Wi-Fi address survives filtering
    expect(candidates.map((c) => c.address)).toEqual(["172.16.14.20"]);
  });

  it("ranks Wi-Fi ahead of Ethernet when both are present", () => {
    const ifaces = {
      Ethernet: [ip("10.0.0.5")],
      "Wi-Fi": [ip("192.168.1.50")],
    };
    const { chosen, candidates } = pickLanAddresses(ifaces, "3000");
    expect(chosen?.address).toBe("192.168.1.50");
    expect(candidates.map((c) => c.address)).toEqual(["192.168.1.50", "10.0.0.5"]);
  });

  it("returns chosen:null when no usable interface exists", () => {
    const ifaces = {
      "Loopback Pseudo-Interface 1": [ip("127.0.0.1", { internal: true })],
      "vEthernet (WSL)": [ip("172.26.48.1")],
    };
    expect(pickLanAddresses(ifaces, "3000")).toEqual({ chosen: null, candidates: [] });
  });
});

describe("portFromHost", () => {
  it("extracts the port from a host header", () => {
    expect(portFromHost("172.16.14.20:3000")).toBe("3000");
  });
  it("falls back when no port present", () => {
    expect(portFromHost("localhost")).toBe("3000");
    expect(portFromHost(null)).toBe("3000");
    expect(portFromHost("localhost", "8080")).toBe("8080");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/dev/lan-address.test.ts`
Expected: FAIL — cannot resolve `@/lib/dev/lan-address`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/dev/lan-address.ts`:

```ts
import type { NetworkInterfaceInfo } from "node:os";

export interface LanCandidate {
  iface: string;
  address: string;
  url: string;
}

// Interface-name fragments we never advertise (virtual adapters / loopback).
const VIRTUAL = [/vethernet/i, /\bwsl\b/i, /hyper-?v/i, /virtualbox/i, /vmware/i, /loopback/i, /docker/i];

// Higher = preferred. Physical wireless first, then wired, then anything else.
function rank(iface: string): number {
  if (/wi-?fi|wireless|wlan/i.test(iface)) return 2;
  if (/ethernet|\ben\b|\beth\b/i.test(iface)) return 1;
  return 0;
}

export function pickLanAddresses(
  ifaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  port: string,
): { chosen: LanCandidate | null; candidates: LanCandidate[] } {
  const candidates: LanCandidate[] = [];

  for (const [iface, addrs] of Object.entries(ifaces)) {
    if (!addrs || VIRTUAL.some((re) => re.test(iface))) continue;
    for (const a of addrs) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue; // link-local
      candidates.push({ iface, address: a.address, url: `http://${a.address}:${port}` });
    }
  }

  candidates.sort((a, b) => rank(b.iface) - rank(a.iface));
  return { chosen: candidates[0] ?? null, candidates };
}

export function portFromHost(host: string | null, fallback = "3000"): string {
  if (!host) return fallback;
  const idx = host.lastIndexOf(":");
  if (idx === -1) return fallback;
  const port = host.slice(idx + 1);
  return /^\d+$/.test(port) ? port : fallback;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/dev/lan-address.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dev/lan-address.ts tests/dev/lan-address.test.ts
git commit -m "feat(dev): LAN address + port helpers for share-to-phone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dev-gated magic-link base

Make magic links point back to whatever host the request came from — but only in dev. Production keeps using `APP_URL`.

**Files:**
- Modify: `src/lib/auth/magic-link.ts` (base resolution at line ~35; signature of `requestMagicLink`)
- Modify: `src/app/api/auth/request/route.ts` (pass the request origin)
- Test: `tests/auth/magic-link.test.ts` (extend existing suite)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `resolveMagicLinkBase(origin?: string): string` (exported from `src/lib/auth/magic-link.ts`)
  - `requestMagicLink(emailRaw: string, opts?: { origin?: string }): Promise<void>` (added optional param; existing single-arg callers keep working)

- [ ] **Step 1: Write the failing test**

Append to `tests/auth/magic-link.test.ts` (inside the file, add a new `describe` block; keep existing imports and add `afterEach`, `vi`):

```ts
import { afterEach, vi } from "vitest";

describe("resolveMagicLinkBase", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the request origin in dev when provided", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(resolveMagicLinkBase("http://172.16.14.20:3000")).toBe("http://172.16.14.20:3000");
  });

  it("falls back to APP_URL in dev when no origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(resolveMagicLinkBase(undefined)).toBe("http://localhost:3000");
  });

  it("ignores the origin in production (never redirected by host)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://rallypoint.example");
    expect(resolveMagicLinkBase("http://attacker.test")).toBe("https://rallypoint.example");
  });
});
```

Update the existing import line to also import `resolveMagicLinkBase`:

```ts
import { requestMagicLink, consumeMagicToken, resolveMagicLinkBase } from "@/lib/auth/magic-link";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/auth/magic-link.test.ts`
Expected: FAIL — `resolveMagicLinkBase` is not exported.

- [ ] **Step 3: Write the minimal implementation**

In `src/lib/auth/magic-link.ts`, add the exported helper and use it. Replace the current base line:

```ts
// remove:
//   const base = process.env.APP_URL ?? "http://localhost:3000";
```

with a call to a new exported function, and change the `requestMagicLink` signature:

```ts
/**
 * Base URL for magic links. Prod always uses APP_URL (an attacker-supplied Host
 * can never redirect a prod link). In dev/test we honor the request origin so a
 * link requested from a phone on the LAN opens on that phone.
 */
export function resolveMagicLinkBase(origin?: string): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.APP_URL ?? "http://localhost:3000";
  }
  return origin ?? process.env.APP_URL ?? "http://localhost:3000";
}

export async function requestMagicLink(
  emailRaw: string,
  opts?: { origin?: string },
): Promise<void> {
  // ...unchanged validation + token creation...
  const base = resolveMagicLinkBase(opts?.origin);
  await emailSender.sendMagicLink(email, `${base}/auth/verify?token=${raw}`);
}
```

(Keep the rest of `requestMagicLink`'s body exactly as-is — only the signature and the `base` line change.)

Then update the caller `src/app/api/auth/request/route.ts` to pass the origin:

```ts
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: unknown };
    await requestMagicLink(String(body.email ?? ""), { origin: req.nextUrl.origin });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/auth/magic-link.test.ts`
Expected: PASS — the 3 new cases plus all pre-existing magic-link tests (the existing tests never assert on host, so they stay green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/magic-link.ts src/app/api/auth/request/route.ts tests/auth/magic-link.test.ts
git commit -m "feat(auth): dev-only magic-link base from request origin

Prod still uses APP_URL. In dev the link points back to the host that
requested it, so login works when the app is opened on a phone.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: qrcode dependency + dev share-url route

Add the QR library and the dev-only route that ties Task 1's helpers to it.

**Files:**
- Modify: `package.json` (add `qrcode` + `@types/qrcode` to devDependencies)
- Create: `src/app/api/dev/share-url/route.ts`
- Test: `tests/dev/share-url-route.test.ts`

**Interfaces:**
- Consumes: `pickLanAddresses`, `portFromHost` from `@/lib/dev/lan-address` (Task 1).
- Produces: `GET` handler returning JSON `{ url: string | null, qrDataUrl: string | null, candidates: Array<{ iface: string; address: string; url: string; qrDataUrl: string }>, error?: string }`.

- [ ] **Step 1: Install the dependency**

Run: `npm install -D qrcode @types/qrcode`
Expected: both added under `devDependencies` in `package.json`; lockfile updated.

- [ ] **Step 2: Write the failing test**

Create `tests/dev/share-url-route.test.ts` — assert the deterministic production guard (the happy path depends on the host's real interfaces and is covered by manual verification):

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "@/app/api/dev/share-url/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/dev/share-url", () => {
  it("404s in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(new Request("http://localhost:3000/api/dev/share-url"));
    expect(res.status).toBe(404);
  });

  it("returns a payload with candidates in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(
      new Request("http://localhost:3000/api/dev/share-url", { headers: { host: "localhost:3000" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: unknown[]; url: string | null };
    expect(Array.isArray(body.candidates)).toBe(true);
    // On a machine with no LAN interface, url is null but the shape still holds.
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/dev/share-url-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/dev/share-url/route`.

- [ ] **Step 4: Write the minimal implementation**

Create `src/app/api/dev/share-url/route.ts`:

```ts
import os from "node:os";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { pickLanAddresses, portFromHost, type LanCandidate } from "@/lib/dev/lan-address";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Dev-only: surface the machine's LAN URL as a QR so a phone on the same Wi-Fi
// can open the running dev app. 404s in production.
export async function GET(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const port = portFromHost(req.headers.get("host"));
    const { chosen, candidates } = pickLanAddresses(os.networkInterfaces(), port);

    if (!chosen) {
      return NextResponse.json({
        url: null,
        qrDataUrl: null,
        candidates: [],
        error: "No LAN interface found — are you on Wi-Fi?",
      });
    }

    const withQr = await Promise.all(
      candidates.map(async (c: LanCandidate) => ({ ...c, qrDataUrl: await QRCode.toDataURL(c.url) })),
    );
    const chosenQr = withQr.find((c) => c.address === chosen.address)!;

    return NextResponse.json({ url: chosenQr.url, qrDataUrl: chosenQr.qrDataUrl, candidates: withQr });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/dev/share-url-route.test.ts`
Expected: PASS (404 case is deterministic; dev case asserts only the payload shape).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/api/dev/share-url/route.ts tests/dev/share-url-route.test.ts
git commit -m "feat(dev): /api/dev/share-url returns LAN URL + QR (dev-only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ShareToPhonePanel component + mount

The visible button. Dev-only client component, mounted beside `MagicLinkBanner`.

**Files:**
- Create: `src/components/dev/ShareToPhonePanel.tsx`
- Modify: `src/app/layout.tsx` (mount the panel next to `MagicLinkBanner`)
- Test: `tests/dev/share-to-phone-panel.test.tsx`

**Interfaces:**
- Consumes: `GET /api/dev/share-url` (Task 3) via `fetch`.
- Produces: `export function ShareToPhonePanel(): JSX.Element | null`.

- [ ] **Step 1: Write the failing test**

Create `tests/dev/share-to-phone-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";

afterEach(() => vi.restoreAllMocks());

describe("ShareToPhonePanel", () => {
  it("shows the trigger button, then the QR after clicking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "http://172.16.14.20:3000",
          qrDataUrl: "data:image/png;base64,AAAA",
          candidates: [
            { iface: "Wi-Fi", address: "172.16.14.20", url: "http://172.16.14.20:3000", qrDataUrl: "data:image/png;base64,AAAA" },
          ],
        }),
      })),
    );

    render(<ShareToPhonePanel />);
    const trigger = screen.getByRole("button", { name: /share to phone/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /qr/i })).toHaveAttribute("src", "data:image/png;base64,AAAA");
      expect(screen.getByText("http://172.16.14.20:3000")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/dev/share-to-phone-panel.test.tsx`
Expected: FAIL — cannot resolve `@/components/dev/ShareToPhonePanel`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/dev/ShareToPhonePanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Smartphone, X, Copy } from "lucide-react";

interface Candidate { iface: string; address: string; url: string; qrDataUrl: string }
interface ShareInfo { url: string | null; qrDataUrl: string | null; candidates: Candidate[]; error?: string }

/** Dev-only: reveal a QR of the machine's LAN URL so a phone can scan it. */
export function ShareToPhonePanel() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (process.env.NODE_ENV === "production") return null;

  async function share() {
    try {
      const res = await fetch("/api/dev/share-url");
      if (!res.ok) return;
      const data = (await res.json()) as ShareInfo;
      setInfo(data);
      setSelected(data.candidates[0]?.address ?? null);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={share}
        className="fixed bottom-3 right-3 z-[95] flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-ink/90"
      >
        <Smartphone className="size-4" aria-hidden />
        Share to phone
      </button>
    );
  }

  const current = info?.candidates.find((c) => c.address === selected) ?? null;

  return (
    <div className="fixed bottom-3 right-3 z-[95] w-64 rounded-xl border border-black/10 bg-white p-3 text-center shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Scan to open on your phone</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-0.5 hover:bg-black/5">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {info?.error || !current ? (
        <p className="py-6 text-xs text-ink/60">{info?.error ?? "You don't appear to be on a Wi-Fi/LAN network."}</p>
      ) : (
        <>
          <img src={current.qrDataUrl} alt="QR code for the LAN URL" className="mx-auto size-40" />
          {info!.candidates.length > 1 && (
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-2 w-full rounded border border-black/10 px-1.5 py-1 text-xs"
            >
              {info!.candidates.map((c) => (
                <option key={c.address} value={c.address}>
                  {c.iface} — {c.address}
                </option>
              ))}
            </select>
          )}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="truncate text-xs text-ink/70">{current.url}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(current.url)}
              aria-label="Copy URL"
              className="rounded p-0.5 hover:bg-black/5"
            >
              <Copy className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-ink/50">
            Phone must be on the same Wi-Fi. First time on Windows, allow Node through the firewall (Private networks).
          </p>
        </>
      )}
    </div>
  );
}
```

Then mount it in `src/app/layout.tsx` — add the import and render it next to `MagicLinkBanner`:

```tsx
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";
// ...
        <ToastProvider>{children}</ToastProvider>
        <MagicLinkBanner />
        <ShareToPhonePanel />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/dev/share-to-phone-panel.test.tsx`
Expected: PASS — trigger button renders; after click the QR `<img>` and URL text appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/dev/ShareToPhonePanel.tsx src/app/layout.tsx tests/dev/share-to-phone-panel.test.tsx
git commit -m "feat(dev): Share-to-phone QR panel mounted beside magic-link banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full gate + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (note: the `<img src={dataUrl}>` may trip `@next/next/no-img-element`; if so, add a scoped `// eslint-disable-next-line @next/next/no-img-element` above that line — a data-URL QR is not an optimizable remote image).

Run: `npm run test`
Expected: all suites pass, including the new `tests/dev/*` and the extended `tests/auth/magic-link.test.ts`.

- [ ] **Step 2: Manual verification on a phone**

Follow the spec's manual verification:
1. `npm run dev`; on desktop click the "📱 Share to phone" button (bottom-right).
2. On a phone on the same Wi-Fi, scan the QR → the app home loads. (If it doesn't load, confirm Windows Defender Firewall allowed Node on Private networks.)
3. On the phone, request a magic link → tap "Open link" in the yellow banner → you're signed in.
4. If more than one interface was listed, confirm the dropdown switches the QR.

- [ ] **Step 3: Confirm prod-inert (optional but recommended)**

Temporarily build/run with `NODE_ENV=production` (or trust the unit tests): the route returns 404 and the panel renders nothing. The automated coverage for this is the 404 test (Task 3) and the production guard in the component.

---

## Self-Review

**Spec coverage:**
- LAN detection + port (spec §1) → Task 1. ✅
- Dev API route with prod-404, per-candidate QR, no-LAN error shape (spec §2) → Task 3. ✅
- Dev panel: trigger button, QR + URL + copy, close, >1-candidate picker, firewall hint, prod-null (spec §3) → Task 4. ✅
- Phone-login fix via `resolveMagicLinkBase` + caller passes origin (spec §4) → Task 2. ✅
- `qrcode` as devDependency (spec §5) → Task 3 Step 1. ✅
- Data flow / error handling / security (spec) → covered across Tasks 2–4 (prod guards, env-gated base). ✅
- Testing: `pickLanAddresses`, `portFromHost`, `resolveMagicLinkBase` (spec Testing) → Tasks 1–2; route/panel thin-glue tests → Tasks 3–4; manual verification → Task 5. ✅

**Placeholder scan:** No TBD/TODO; every code step has concrete code; no "similar to Task N" references. ✅

**Type consistency:** `LanCandidate { iface, address, url }` (Task 1) is extended to include `qrDataUrl` by the route (Task 3) and consumed with that exact shape by the panel's `Candidate` interface (Task 4). `resolveMagicLinkBase(origin?: string)` and `requestMagicLink(email, opts?: { origin })` names/signatures match between Task 2's definition and the test. Route return keys (`url`, `qrDataUrl`, `candidates`, `error`) match the panel's `ShareInfo`. ✅
