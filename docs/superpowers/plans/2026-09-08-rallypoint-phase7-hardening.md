# RallyPoint Phase 7 — Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make standalone RallyPoint safe to deploy for a controlled 3–5 venue pilot by closing the audit's launch-configuration gaps — no new product features, no Sentry work, no push.

**Architecture:** A single lazy, dependency-free environment-validation layer (`src/lib/env.ts`) is the backbone: it is invoked at server startup via `src/instrumentation.ts` (fail-fast in production) and read lazily at request time by consumers, so `next build` never needs secrets. On top of it: a Resend production email sender behind the existing `EmailSender` seam, a `Secure` production session cookie, persistent payment-disclosure pages, a minimal structured logger, SEO routes, upload hardening, and an availability query-fan-out reduction. Object storage stays `LocalFsStorage` (pilot runs on a persistent-disk host); the seam is preserved for the P1 S3 migration.

**Tech Stack:** Next.js 16 (App Router, `standalone`), TypeScript (strict), Prisma 5 + PostgreSQL 16, `jose` sessions, Vitest, `resend` (new).

## Global Constraints

- **Branch:** `build/phase7-hardening`. Per-sub-phase **local** commits. **NEVER push** (no `git push`) until explicitly instructed.
- **DO NOT CHANGE:** `LocalBookingBackend` booking semantics; the PostgreSQL `EXCLUDE` constraint `bookings_no_overlap`; the `btree_gist` requirement; the booking state machine (`src/lib/booking/status.ts`); idempotency behavior; the owner authorization model (`assertVenueAccess` chain); the review eligibility model; notification transaction behavior (fire-after-commit, non-fatal); the standalone LOCAL architecture.
- **Sentry stays inert.** No Sentry feature work. Never mark a venue `CONNECTED`.
- **Env validation is LAZY.** Never call `loadEnv()`/`getEnv()` at module top level in code that `next build` imports (route handlers, components). Only `instrumentation.ts` (startup) and inside functions (request time). This keeps `npm run build` green without secrets.
- **Strict validation only when `NODE_ENV==="production"`.** In `development`/`test`, dev defaults remain valid so the existing Vitest suite and local dev keep working.
- **Never log or embed secret values** in errors/logs: JWT secret, magic-link tokens, JWT cookies, API keys, payment-proof bytes.
- **Migrations:** never run `prisma migrate dev`. No schema changes are needed this phase.
- **Verify after every task:** `npm run typecheck` (exit 0) → `npm run lint` (exit 0) → `npm test` (all green). PostgreSQL must be up (`docker compose up -d`, host port 55432).
- New runtime dependency allowed: `resend`. No other new runtime deps.

## File Structure

**Create:**
- `src/lib/env.ts` — env parsing/validation (`loadEnv`, `getEnv`, `EnvValidationError`, `AppEnv`).
- `src/instrumentation.ts` — Next `register()`; fail-fast env validation at startup.
- `src/lib/email/select.ts` — `selectEmailSender(env)` pure selector.
- `src/lib/email/resend-sender.ts` — `ResendSender implements EmailSender`.
- `src/lib/email/capture-sender.ts` — `FileCaptureSender` (E2E-only, env-selected).
- `src/lib/log.ts` — structured JSON logger with redaction.
- `src/lib/legal/content.ts` — editable policy content (template, not legal advice).
- `src/app/(site)/terms/page.tsx`, `.../privacy/page.tsx`, `.../payment-policy/page.tsx` — public policy pages.
- `src/app/robots.ts`, `src/app/sitemap.ts` — SEO routes.
- `src/lib/storage/sniff.ts` — `sniffImageType(bytes)` magic-byte detection.
- `src/lib/storage/upload.ts` — `validateUploadFile({size,type})` pre-buffer guard.
- Tests: `tests/env/env.test.ts`, `tests/email/select.test.ts`, `tests/email/resend-sender.test.ts`, `tests/auth/session-cookie.test.ts`, `tests/log/log.test.ts`, `tests/http/error-response.test.ts`, `tests/seo/robots.test.ts`, `tests/seo/sitemap.test.ts`, `tests/storage/sniff.test.ts`, `tests/storage/upload.test.ts`, `tests/policy/pages.test.ts`, `tests/e2e/smoke.e2e.test.ts`, `tests/e2e/server.ts`.

**Modify:**
- `src/lib/auth/session.ts` — secret via `getEnv()`; `sessionCookieAttrs(isProduction)`; `Secure` in prod.
- `src/lib/auth/magic-link.ts` — `APP_URL` via `getEnv()`.
- `src/app/layout.tsx` — `metadataBase` via `getEnv()`.
- `src/lib/sentry/credentials.ts` — remove hardcoded fallback; require secret via env when used.
- `src/lib/email/index.ts` — lazy delegating `emailSender`.
- `src/lib/http.ts` — log ≥500 errors via structured logger.
- `src/lib/storage/local-fs-storage.ts` — magic-byte sniff on save.
- `src/app/api/bookings/[id]/payment/route.ts`, `src/app/api/owner/venues/[id]/photos/route.ts` — pre-buffer `validateUploadFile`.
- `src/lib/availability/engine.ts` — batch per-venue queries; extract `computeSlots`.
- `src/components/booking/PaymentStep.tsx`, `src/app/(site)/layout.tsx`, `src/app/(site)/bookings/[reference]/page.tsx` — policy links.
- `.env.example` — document all variables.
- `package.json` — add `resend`; add `test:e2e` script.

---

## AppEnv contract (used by many tasks)

```ts
// Shape returned by loadEnv / getEnv (defined in Task 1). Later tasks consume it.
export interface AppEnv {
  NODE_ENV: "development" | "test" | "production";
  isProduction: boolean;
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_URL: string;                 // absolute; https + non-localhost in prod
  HOLD_MINUTES: number;            // default 10
  email:
    | { provider: "dev" }
    | { provider: "resend"; resendApiKey: string; from: string }
    | { provider: "capture"; capturePath: string };
  sentry: { mode?: string; baseUrl?: string; credSecret?: string };
}
```

Dev-value constants (rejected in production): `DEV_JWT = "dev-secret-change-in-production"`, `DEV_SENTRY = "dev-sentry-secret-change-in-production"`.

---

## P0-B · Task 1: Environment validation core

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/env/env.test.ts`

**Interfaces:**
- Produces: `AppEnv` (above); `loadEnv(raw?: NodeJS.ProcessEnv): AppEnv`; `getEnv(): AppEnv` (memoized `loadEnv(process.env)`); `class EnvValidationError extends Error`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/env/env.test.ts
import { describe, it, expect } from "vitest";
import { loadEnv, EnvValidationError } from "@/lib/env";

const PROD_OK = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@db:5432/rp",
  JWT_SECRET: "x".repeat(40),
  APP_URL: "https://rallypoint.ph",
  RESEND_API_KEY: "re_live_abc",
  EMAIL_FROM: "RallyPoint <no-reply@rallypoint.ph>",
} as unknown as NodeJS.ProcessEnv;

describe("loadEnv", () => {
  it("accepts a complete production env", () => {
    const env = loadEnv(PROD_OK);
    expect(env.isProduction).toBe(true);
    expect(env.email.provider).toBe("resend");
    expect(env.HOLD_MINUTES).toBe(10);
  });

  it("rejects a missing JWT_SECRET in production, naming it without a value", () => {
    const { JWT_SECRET, ...rest } = PROD_OK as Record<string, string>;
    void JWT_SECRET;
    try {
      loadEnv(rest as NodeJS.ProcessEnv);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      expect((e as Error).message).toContain("JWT_SECRET");
    }
  });

  it("rejects the known dev JWT secret in production", () => {
    expect(() => loadEnv({ ...PROD_OK, JWT_SECRET: "dev-secret-change-in-production" } as NodeJS.ProcessEnv))
      .toThrow(EnvValidationError);
  });

  it("rejects a localhost APP_URL in production", () => {
    expect(() => loadEnv({ ...PROD_OK, APP_URL: "http://localhost:3000" } as NodeJS.ProcessEnv))
      .toThrow(EnvValidationError);
  });

  it("rejects missing email config in production", () => {
    const { RESEND_API_KEY, ...rest } = PROD_OK as Record<string, string>;
    void RESEND_API_KEY;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(EnvValidationError);
  });

  it("never includes a provided secret value in the error message", () => {
    const secret = "super-secret-value-1234567890";
    try {
      loadEnv({ ...PROD_OK, JWT_SECRET: secret, APP_URL: "http://localhost" } as NodeJS.ProcessEnv);
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });

  it("allows dev defaults in development", () => {
    const env = loadEnv({ NODE_ENV: "development", DATABASE_URL: "postgresql://x" } as NodeJS.ProcessEnv);
    expect(env.isProduction).toBe(false);
    expect(env.JWT_SECRET).toBe("dev-secret-change-in-production");
    expect(env.email.provider).toBe("dev");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("selects the capture email provider when a capture path is set (any NODE_ENV)", () => {
    const env = loadEnv({ ...PROD_OK, MAGIC_LINK_CAPTURE_PATH: "/tmp/links.jsonl" } as NodeJS.ProcessEnv);
    expect(env.email).toEqual({ provider: "capture", capturePath: "/tmp/links.jsonl" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/env/env.test.ts`
Expected: FAIL (module `@/lib/env` not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/env.ts
export class EnvValidationError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n- ${problems.join("\n- ")}`);
    this.name = "EnvValidationError";
  }
}

export interface AppEnv {
  NODE_ENV: "development" | "test" | "production";
  isProduction: boolean;
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_URL: string;
  HOLD_MINUTES: number;
  email:
    | { provider: "dev" }
    | { provider: "resend"; resendApiKey: string; from: string }
    | { provider: "capture"; capturePath: string };
  sentry: { mode?: string; baseUrl?: string; credSecret?: string };
}

const DEV_JWT = "dev-secret-change-in-production";
const DEV_SENTRY = "dev-sentry-secret-change-in-production";

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const problems: string[] = [];
  const nodeEnv = (raw.NODE_ENV as AppEnv["NODE_ENV"]) ?? "development";
  const isProduction = nodeEnv === "production";

  const DATABASE_URL = raw.DATABASE_URL ?? "";
  if (!DATABASE_URL) problems.push("DATABASE_URL is required");

  // JWT_SECRET
  let JWT_SECRET = raw.JWT_SECRET ?? "";
  if (isProduction) {
    if (!JWT_SECRET) problems.push("JWT_SECRET is required in production");
    else if (JWT_SECRET === DEV_JWT) problems.push("JWT_SECRET must not be the development default");
    else if (JWT_SECRET.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  } else if (!JWT_SECRET) {
    JWT_SECRET = DEV_JWT;
  }

  // APP_URL
  let APP_URL = raw.APP_URL ?? "";
  if (isProduction) {
    if (!APP_URL) problems.push("APP_URL is required in production");
    else {
      try {
        const u = new URL(APP_URL);
        if (u.protocol !== "https:") problems.push("APP_URL must use https in production");
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1")
          problems.push("APP_URL must not be localhost in production");
      } catch {
        problems.push("APP_URL must be a valid absolute URL");
      }
    }
  } else if (!APP_URL) {
    APP_URL = "http://localhost:3000";
  }

  const HOLD_MINUTES = Number(raw.HOLD_MINUTES ?? "10") || 10;

  // Email provider selection
  let email: AppEnv["email"];
  const capturePath = raw.MAGIC_LINK_CAPTURE_PATH;
  if (capturePath) {
    email = { provider: "capture", capturePath };
  } else if (isProduction) {
    const resendApiKey = raw.RESEND_API_KEY ?? "";
    const from = raw.EMAIL_FROM ?? "";
    if (!resendApiKey) problems.push("RESEND_API_KEY is required in production");
    if (!from) problems.push("EMAIL_FROM is required in production");
    email = { provider: "resend", resendApiKey, from };
  } else {
    email = { provider: "dev" };
  }

  // Sentry: fallback removed; required only when a Sentry mode/base is enabled.
  const sentryEnabled = Boolean(raw.SENTRY_MODE || raw.SENTRY_BASE_URL);
  const credSecret = raw.SENTRY_CRED_SECRET;
  if (isProduction && sentryEnabled) {
    if (!credSecret) problems.push("SENTRY_CRED_SECRET is required when Sentry is enabled in production");
    else if (credSecret === DEV_SENTRY) problems.push("SENTRY_CRED_SECRET must not be the development default");
  }

  if (problems.length) throw new EnvValidationError(problems);

  return {
    NODE_ENV: nodeEnv,
    isProduction,
    DATABASE_URL,
    JWT_SECRET,
    APP_URL,
    HOLD_MINUTES,
    email,
    sentry: { mode: raw.SENTRY_MODE, baseUrl: raw.SENTRY_BASE_URL, credSecret },
  };
}

let cached: AppEnv | undefined;
export function getEnv(): AppEnv {
  return (cached ??= loadEnv());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/env/env.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (no consumer changed yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts tests/env/env.test.ts
git commit -m "feat(env): lazy production environment validation layer"
```

---

## P0-B · Task 2: Fail-fast wiring + remove production fallbacks

**Files:**
- Create: `src/instrumentation.ts`
- Modify: `src/lib/auth/session.ts` (secret only), `src/lib/auth/magic-link.ts:34`, `src/app/layout.tsx:7`, `src/lib/sentry/credentials.ts:7-10`
- Modify: `.env.example`
- Test: reuse `tests/auth/magic-link.test.ts` (must stay green), `tests/sentry/credentials.test.ts` (must stay green)

**Interfaces:**
- Consumes: `getEnv()` from Task 1.
- Produces: `register()` in `src/instrumentation.ts`.

- [ ] **Step 1: Add startup fail-fast**

```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    getEnv(); // throws EnvValidationError in production if config is unsafe
  }
}
```

- [ ] **Step 2: Refactor `session.ts` secret to lazy env (remove fallback)**

Replace the top-level `SECRET` const:

```ts
// src/lib/auth/session.ts  (imports)
import { getEnv } from "@/lib/env";
// remove: const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "...");

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}
```

Then in `signSession` use `.sign(secretKey())` and in `verifySession` use `jwtVerify(token, secretKey())`. (Cookie changes come in Task 3.)

- [ ] **Step 3: Refactor `magic-link.ts` and `layout.tsx` to `getEnv().APP_URL`**

```ts
// src/lib/auth/magic-link.ts  — replace line 34
import { getEnv } from "@/lib/env";
// ...
const base = getEnv().APP_URL;
```

```ts
// src/app/layout.tsx — replace metadataBase line
import { getEnv } from "@/lib/env";
// metadataBase: new URL(getEnv().APP_URL)
```

- [ ] **Step 4: Remove the `credentials.ts` hardcoded fallback**

```ts
// src/lib/sentry/credentials.ts — replace key()
import { getEnv } from "@/lib/env";
function key(): Buffer {
  const secret = getEnv().sentry.credSecret ?? process.env.SENTRY_CRED_SECRET;
  if (!secret) throw new ValidationError("SENTRY_CRED_SECRET is not configured");
  return createHash("sha256").update(secret).digest();
}
```

(In dev/test with `SENTRY_MODE=mock`, the cipher tests set `SENTRY_CRED_SECRET`; if they don't, they must — see Step 6.)

- [ ] **Step 5: Document all variables in `.env.example`**

```dotenv
# --- Required in production ---
DATABASE_URL="postgresql://rallypoint:rallypoint@127.0.0.1:55432/rallypoint?schema=public"
JWT_SECRET="dev-secret-change-in-production"   # MUST override with a 32+ char random value in prod
APP_URL="http://localhost:3000"                # MUST be your https:// origin in prod
NODE_ENV="development"
RESEND_API_KEY=""                              # required in production (magic-link delivery)
EMAIL_FROM=""                                  # e.g. "RallyPoint <no-reply@yourdomain>"
# HOLD_MINUTES has an in-code default of 10
HOLD_MINUTES="10"

# --- Dev / test only ---
TEST_DATABASE_URL="postgresql://rallypoint:rallypoint@127.0.0.1:55432/rallypoint_test?schema=public"

# --- Only if enabling the (inert) Sentry connector — NOT needed for the pilot ---
# SENTRY_MODE="mock"
# SENTRY_BASE_URL=""
# SENTRY_CRED_SECRET=""                         # required if Sentry enabled; no dev fallback
```

- [ ] **Step 6: Ensure credential test sets its secret**

Open `tests/sentry/credentials.test.ts`. If it relies on the old fallback, add at top:
```ts
process.env.SENTRY_CRED_SECRET ??= "test-sentry-cred-secret-0123456789";
```
(Set before importing `credentialCipher`.)

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green — magic-link, session-consuming, and credentials tests pass with dev env.

- [ ] **Step 8: Commit**

```bash
git add src/instrumentation.ts src/lib/auth/session.ts src/lib/auth/magic-link.ts src/app/layout.tsx src/lib/sentry/credentials.ts .env.example tests/sentry/credentials.test.ts
git commit -m "feat(env): fail-fast at startup and remove production secret fallbacks"
```

---

## P0-C · Task 3: Production session cookie `Secure`

**Files:**
- Modify: `src/lib/auth/session.ts:54-67`
- Test: `tests/auth/session-cookie.test.ts`

**Interfaces:**
- Produces: `sessionCookieAttrs(isProduction: boolean): { httpOnly: true; path: "/"; sameSite: "lax"; secure: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth/session-cookie.test.ts
import { describe, it, expect } from "vitest";
import { sessionCookieAttrs } from "@/lib/auth/session";

describe("session cookie attributes", () => {
  it("is Secure in production and preserves HttpOnly + SameSite", () => {
    const a = sessionCookieAttrs(true);
    expect(a).toEqual({ httpOnly: true, path: "/", sameSite: "lax", secure: true });
  });

  it("is not Secure in development so local HTTP login works", () => {
    expect(sessionCookieAttrs(false).secure).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/session-cookie.test.ts`
Expected: FAIL (`sessionCookieAttrs` not exported).

- [ ] **Step 3: Implement**

```ts
// src/lib/auth/session.ts
export function sessionCookieAttrs(isProduction: boolean) {
  return { httpOnly: true as const, path: "/" as const, sameSite: "lax" as const, secure: isProduction };
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, maxAge: MAX_AGE, ...sessionCookieAttrs(getEnv().isProduction) };
}

export function clearSessionCookie() {
  return { name: SESSION_COOKIE, value: "", maxAge: 0, ...sessionCookieAttrs(getEnv().isProduction) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/session-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/session.ts tests/auth/session-cookie.test.ts
git commit -m "feat(auth): Secure session cookie in production"
```

---

## P0-A · Task 4: Resend production email + lazy selection

**Files:**
- Create: `src/lib/email/resend-sender.ts`, `src/lib/email/capture-sender.ts`, `src/lib/email/select.ts`
- Modify: `src/lib/email/index.ts`, `package.json`
- Test: `tests/email/select.test.ts`, `tests/email/resend-sender.test.ts`

**Interfaces:**
- Consumes: `AppEnv`/`getEnv()` (Task 1), `EmailSender` (`src/lib/email/sender.ts`).
- Produces: `selectEmailSender(env: AppEnv): EmailSender`; `class ResendSender implements EmailSender` with ctor `{ apiKey: string; from: string; client?: ResendLike }`; `class FileCaptureSender implements EmailSender` with ctor `(path: string)`.

- [ ] **Step 1: Install the dependency**

Run: `npm install resend`
Expected: `resend` added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/email/select.test.ts
import { describe, it, expect } from "vitest";
import { selectEmailSender } from "@/lib/email/select";
import { ResendSender } from "@/lib/email/resend-sender";
import { DevConsoleSender } from "@/lib/email/dev-sender";
import { FileCaptureSender } from "@/lib/email/capture-sender";
import type { AppEnv } from "@/lib/env";

const base: AppEnv = {
  NODE_ENV: "production", isProduction: true, DATABASE_URL: "x", JWT_SECRET: "x".repeat(40),
  APP_URL: "https://x.ph", HOLD_MINUTES: 10, email: { provider: "dev" }, sentry: {},
};

describe("selectEmailSender", () => {
  it("returns ResendSender for the resend provider", () => {
    const s = selectEmailSender({ ...base, email: { provider: "resend", resendApiKey: "re_x", from: "a@b" } });
    expect(s).toBeInstanceOf(ResendSender);
  });
  it("returns DevConsoleSender for the dev provider", () => {
    expect(selectEmailSender({ ...base, isProduction: false, NODE_ENV: "development", email: { provider: "dev" } }))
      .toBeInstanceOf(DevConsoleSender);
  });
  it("returns FileCaptureSender for the capture provider", () => {
    expect(selectEmailSender({ ...base, email: { provider: "capture", capturePath: "/tmp/x" } }))
      .toBeInstanceOf(FileCaptureSender);
  });
});
```

```ts
// tests/email/resend-sender.test.ts
import { describe, it, expect } from "vitest";
import { ResendSender } from "@/lib/email/resend-sender";

describe("ResendSender", () => {
  it("sends via the injected client with from/to and the link in the body", async () => {
    const calls: any[] = [];
    const client = { emails: { send: async (args: any) => { calls.push(args); return { data: { id: "1" }, error: null }; } } };
    const sender = new ResendSender({ apiKey: "re_x", from: "RallyPoint <no-reply@rp.ph>", client });
    await sender.sendMagicLink("player@example.com", "https://rp.ph/auth/verify?token=abc");
    expect(calls).toHaveLength(1);
    expect(calls[0].from).toBe("RallyPoint <no-reply@rp.ph>");
    expect(calls[0].to).toBe("player@example.com");
    expect(String(calls[0].html) + String(calls[0].text)).toContain("https://rp.ph/auth/verify?token=abc");
  });

  it("throws when the provider returns an error", async () => {
    const client = { emails: { send: async () => ({ data: null, error: { message: "bad" } }) } };
    const sender = new ResendSender({ apiKey: "re_x", from: "a@b", client });
    await expect(sender.sendMagicLink("x@y.com", "https://z")).rejects.toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/email/select.test.ts tests/email/resend-sender.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement senders and selector**

```ts
// src/lib/email/resend-sender.ts
import { Resend } from "resend";
import type { EmailSender } from "./sender";

export interface ResendLike {
  emails: { send(args: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ data: unknown; error: unknown }> };
}

export class ResendSender implements EmailSender {
  private readonly client: ResendLike;
  constructor(private readonly opts: { apiKey: string; from: string; client?: ResendLike }) {
    this.client = opts.client ?? (new Resend(opts.apiKey) as unknown as ResendLike);
  }
  async sendMagicLink(to: string, url: string): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.opts.from,
      to,
      subject: "Your RallyPoint sign-in link",
      html: `<p>Tap to sign in to RallyPoint:</p><p><a href="${url}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
      text: `Sign in to RallyPoint: ${url}\nThis link expires in 15 minutes.`,
    });
    if (error) throw new Error("Email delivery failed");
  }
}
```

```ts
// src/lib/email/capture-sender.ts
import { appendFile } from "node:fs/promises";
import type { EmailSender } from "./sender";

/** E2E/test-only: writes the magic link to a file the test harness reads. Never used unless MAGIC_LINK_CAPTURE_PATH is set. */
export class FileCaptureSender implements EmailSender {
  constructor(private readonly path: string) {}
  async sendMagicLink(to: string, url: string): Promise<void> {
    await appendFile(this.path, JSON.stringify({ to: to.toLowerCase(), url }) + "\n", "utf8");
  }
}
```

```ts
// src/lib/email/select.ts
import type { AppEnv } from "@/lib/env";
import type { EmailSender } from "./sender";
import { DevConsoleSender } from "./dev-sender";
import { ResendSender } from "./resend-sender";
import { FileCaptureSender } from "./capture-sender";

export function selectEmailSender(env: AppEnv): EmailSender {
  switch (env.email.provider) {
    case "resend": return new ResendSender({ apiKey: env.email.resendApiKey, from: env.email.from });
    case "capture": return new FileCaptureSender(env.email.capturePath);
    default: return new DevConsoleSender();
  }
}
```

- [ ] **Step 5: Make `index.ts` lazy (defer selection/validation to first send)**

```ts
// src/lib/email/index.ts
import type { EmailSender } from "./sender";
import { getEnv } from "@/lib/env";
import { selectEmailSender } from "./select";

let _sender: EmailSender | undefined;
function sender(): EmailSender {
  return (_sender ??= selectEmailSender(getEnv()));
}

/** Lazy delegating sender: selection (and prod env validation) happens on first send, not at import. */
export const emailSender: EmailSender = {
  sendMagicLink: (to, url) => sender().sendMagicLink(to, url),
};

export * from "./sender";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/email/select.test.ts tests/email/resend-sender.test.ts tests/auth/magic-link.test.ts`
Expected: PASS (magic-link test still uses DevConsoleSender in dev and finds the link in `lastMagicLinks`).

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/email package.json package-lock.json tests/email
git commit -m "feat(email): Resend production sender behind lazy EmailSender selection"
```

---

## P0-D · Task 5: Payment-disclosure pages + links

**Files:**
- Create: `src/lib/legal/content.ts`, `src/app/(site)/terms/page.tsx`, `src/app/(site)/privacy/page.tsx`, `src/app/(site)/payment-policy/page.tsx`
- Modify: `src/app/(site)/layout.tsx` (footer links), `src/components/booking/PaymentStep.tsx` (policy link), `src/app/(site)/bookings/[reference]/page.tsx` (policy link)
- Test: `tests/policy/pages.test.ts`

**Interfaces:**
- Produces: `POLICIES: { slug: "terms"|"privacy"|"payment-policy"; title: string; updated: string; body: string[] }[]` and helper `getPolicy(slug): Policy | undefined` in `src/lib/legal/content.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/policy/pages.test.ts
import { describe, it, expect } from "vitest";
import { POLICIES, getPolicy } from "@/lib/legal/content";

describe("policy content", () => {
  it("exposes terms, privacy, and payment-policy", () => {
    expect(POLICIES.map((p) => p.slug).sort()).toEqual(["payment-policy", "privacy", "terms"]);
  });

  it("states the four required payment disclosures in the payment policy", () => {
    const text = getPolicy("payment-policy")!.body.join(" ").toLowerCase();
    expect(text).toContain("directly to the venue");
    expect(text).toContain("does not hold");
    expect(text).toContain("does not");            // does not verify settlement
    expect(text).toContain("verify");
    expect(text).toContain("refund");              // refunds/disputes per venue policy
    expect(text).toContain("venue's policy");
  });

  it("marks content as a template for review, not legal advice", () => {
    expect(getPolicy("terms")!.body.join(" ").toLowerCase()).toContain("not legal advice");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/policy/pages.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement editable content**

```ts
// src/lib/legal/content.ts
export interface Policy {
  slug: "terms" | "privacy" | "payment-policy";
  title: string;
  updated: string; // e.g. "2026-09-08"
  body: string[];  // paragraphs
}

const TEMPLATE_NOTE =
  "This document is a template provided for the venue/business owner to review and finalize. It is not legal advice.";

export const POLICIES: Policy[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    updated: "2026-09-08",
    body: [
      TEMPLATE_NOTE,
      "RallyPoint is a marketplace that helps players discover and reserve courts at independent venues. RallyPoint is not a party to the booking agreement between a player and a venue.",
      "By using RallyPoint you agree to provide accurate information and to follow each venue's house rules and cancellation policy.",
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    updated: "2026-09-08",
    body: [
      TEMPLATE_NOTE,
      "We collect the information you provide to make a booking — your email, optional name and mobile number, and the payment reference and screenshot you upload — and share it with the venue you book so they can confirm your reservation.",
      "Payment screenshots are stored privately and are visible only to you, the venue, and RallyPoint administrators.",
    ],
  },
  {
    slug: "payment-policy",
    title: "Payment Policy",
    updated: "2026-09-08",
    body: [
      TEMPLATE_NOTE,
      "Payment is made directly to the venue using the venue's own payment methods (for example GCash, Maya, or bank transfer). RallyPoint does not hold, process, or receive customer money.",
      "RallyPoint does not independently verify that a payment has settled. The screenshot you upload is submitted to the venue as evidence; the venue confirms your booking at its discretion.",
      "Refunds, cancellations, and payment disputes are handled according to the venue's policy. Please contact the venue directly for any refund or dispute.",
    ],
  },
];

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug);
}
```

- [ ] **Step 4: Implement the three pages (one per slug)**

```tsx
// src/app/(site)/payment-policy/page.tsx
import type { Metadata } from "next";
import { getPolicy } from "@/lib/legal/content";

const policy = getPolicy("payment-policy")!;
export const metadata: Metadata = { title: policy.title, description: "How payments work on RallyPoint." };

export default function PaymentPolicyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">{policy.title}</h1>
      <p className="text-sm text-muted">Last updated {policy.updated}</p>
      {policy.body.map((p, i) => (
        <p key={i} className="text-sm leading-6 text-ink-soft">{p}</p>
      ))}
    </article>
  );
}
```

Create `terms/page.tsx` and `privacy/page.tsx` identically, swapping `getPolicy("terms")` / `getPolicy("privacy")` and the metadata description. (Repeat the code — do not reference "same as above".)

- [ ] **Step 5: Link policies from the flow**

In `src/app/(site)/layout.tsx`, add to the footer `<p className="flex gap-4">` link row:
```tsx
<Link href="/terms" className="hover:text-ink">Terms</Link>
<Link href="/privacy" className="hover:text-ink">Privacy</Link>
<Link href="/payment-policy" className="hover:text-ink">Payment policy</Link>
```

In `src/components/booking/PaymentStep.tsx`, under the disclosure box (after line 88's `<p>` amount), add:
```tsx
<p className="mt-2 text-xs text-brand-800">
  See our <a href="/payment-policy" className="underline">payment policy</a>.
</p>
```

In `src/app/(site)/bookings/[reference]/page.tsx`, near the existing "Payment goes to the venue" copy, add a link to `/payment-policy`.

- [ ] **Step 6: Run tests + verify routes build**

Run: `npx vitest run tests/policy/pages.test.ts && npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/legal "src/app/(site)/terms" "src/app/(site)/privacy" "src/app/(site)/payment-policy" "src/app/(site)/layout.tsx" src/components/booking/PaymentStep.tsx "src/app/(site)/bookings/[reference]/page.tsx" tests/policy
git commit -m "feat(legal): payment/terms/privacy policy pages linked from the flow"
```

---

## P1-E · Task 6: Structured logger

**Files:**
- Create: `src/lib/log.ts`
- Test: `tests/log/log.test.ts`

**Interfaces:**
- Produces: `log.info(msg, ctx?)`, `log.warn(msg, ctx?)`, `log.error(msg, ctx?)` where `ctx?: Record<string, unknown>`; sensitive keys are redacted.

- [ ] **Step 1: Write the failing test**

```ts
// tests/log/log.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("structured logger", () => {
  it("emits a single JSON line with level and message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("boom", { code: "X", status: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.level).toBe("error");
    expect(line.msg).toBe("boom");
    expect(line.code).toBe("X");
  });

  it("redacts sensitive fields", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("auth", { token: "raw-secret", password: "p", email: "a@b.com" });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.token).toBeUndefined();
    expect(line.password).toBeUndefined();
    expect(line.email).toBe("a@b.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/log/log.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/log.ts
type Level = "info" | "warn" | "error";
const SENSITIVE = ["token", "password", "secret", "authorization", "apikey", "jwt", "proof", "bytes"];

function redact(ctx?: Record<string, unknown>): Record<string, unknown> {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE.some((s) => k.toLowerCase().includes(s))) continue;
    out[k] = v;
  }
  return out;
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...redact(ctx) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/log/log.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, full suite; then commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/log.ts tests/log
git commit -m "feat(log): minimal structured JSON logger with redaction"
```

---

## P1-E · Task 7: Log ≥500 errors in `errorResponse`

**Files:**
- Modify: `src/lib/http.ts`
- Test: `tests/http/error-response.test.ts`

**Interfaces:**
- Consumes: `log` (Task 6), `AppError` (`src/lib/booking/errors.ts`).
- Produces: `errorResponse(e: unknown, ctx?: Record<string, unknown>): NextResponse` (ctx optional — existing `errorResponse(e)` callers unchanged).

- [ ] **Step 1: Write the failing test**

```ts
// tests/http/error-response.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { errorResponse } from "@/lib/http";
import { AppError, ValidationError } from "@/lib/booking/errors";

afterEach(() => vi.restoreAllMocks());

// AppError signature (confirmed): constructor(message, httpStatus, code) — codes are lowercase.
class ServerError extends AppError {
  constructor() { super("nope", 500, "server_error"); }
}

describe("errorResponse", () => {
  it("logs 5xx AppErrors with code and status", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new ServerError(), { route: "/x" });
    expect(res.status).toBe(500);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.code).toBe("server_error");
    expect(line.route).toBe("/x");
  });

  it("does not log 4xx AppErrors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new ValidationError("bad"));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/http/error-response.test.ts`
Expected: FAIL (no logging yet / signature).

- [ ] **Step 3: Implement**

```ts
// src/lib/http.ts
import { NextResponse } from "next/server";
import { AppError } from "@/lib/booking/errors";
import { log } from "@/lib/log";

export function errorResponse(e: unknown, ctx?: Record<string, unknown>): NextResponse {
  if (e instanceof AppError) {
    if (e.httpStatus >= 500) log.error("app_error", { code: e.code, status: e.httpStatus, ...ctx });
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
  }
  log.error("unhandled_error", { message: e instanceof Error ? e.message : String(e), ...ctx });
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
```

- [ ] **Step 4: Run test to verify it passes; full suite**

Run: `npx vitest run tests/http/error-response.test.ts && npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/http.ts tests/http
git commit -m "feat(log): log 5xx errors in errorResponse with safe context"
```

---

## P1-F · Task 8: `robots.ts`

**Files:**
- Create: `src/app/robots.ts`
- Test: `tests/seo/robots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/seo/robots.test.ts
import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("disallows private paths and points at the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = (rule.disallow as string[]);
    for (const p of ["/owner", "/admin", "/book", "/bookings", "/login", "/api"]) {
      expect(disallow).toContain(p);
    }
    expect(String(r.sitemap)).toContain("/sitemap.xml");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seo/robots.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getEnv().APP_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/owner", "/admin", "/book", "/bookings", "/login", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes; full suite; commit**

```bash
npx vitest run tests/seo/robots.test.ts && npm run typecheck && npm run lint && npm test
git add src/app/robots.ts tests/seo/robots.test.ts
git commit -m "feat(seo): robots.ts disallowing private paths"
```

---

## P1-F · Task 9: `sitemap.ts`

**Files:**
- Create: `src/app/sitemap.ts`
- Test: `tests/seo/sitemap.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getEnv()`. Uses existing `tests/db.ts` helpers (`prisma`, `resetDb`) and `tests/factories.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/seo/sitemap.test.ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import sitemap from "@/app/sitemap";

beforeEach(resetDb);

async function makeVenue(slug: string, isPublished: boolean, status: "APPROVED" | "DRAFT") {
  const owner = await prisma.user.create({ data: { email: `${slug}@o.com`, role: "OWNER" } });
  await prisma.venue.create({
    data: { slug, name: slug, city: "Davao City", ownerId: owner.id, isPublished, status },
  });
}

describe("sitemap", () => {
  it("includes live venues and excludes drafts", async () => {
    await makeVenue("live-venue", true, "APPROVED");
    await makeVenue("draft-venue", false, "DRAFT");
    const entries = await sitemap();
    const urls = entries.map((e) => String(e.url));
    expect(urls.some((u) => u.endsWith("/venues/live-venue"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/venues/draft-venue"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/payment-policy"))).toBe(true);
  });
});
```

(`tests/factories.ts` `seedOwnerVenueCourt()` already creates an APPROVED+published venue — you may use it for the live case — but there is no draft-venue factory, so create the draft inline as above. Venue requires `slug`, `name`, `ownerId`; `city` defaults to "Davao City".)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seo/sitemap.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic"; // query at request time, not build time

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getEnv().APP_URL;
  const venues = await prisma.venue.findMany({
    where: { isPublished: true, status: "APPROVED" },
    select: { slug: true, updatedAt: true },
  });
  const now = new Date();
  const staticPaths = ["", "/search", "/list-your-venue", "/terms", "/privacy", "/payment-policy"];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, lastModified: now })),
    ...venues.map((v) => ({ url: `${base}/venues/${v.slug}`, lastModified: v.updatedAt })),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes; full suite; commit**

```bash
npx vitest run tests/seo/sitemap.test.ts && npm run typecheck && npm run lint && npm test
git add src/app/sitemap.ts tests/seo/sitemap.test.ts
git commit -m "feat(seo): sitemap.ts for live venues and public pages"
```

---

## P1-G · Task 10: Upload hardening (magic-byte + pre-buffer size)

**Files:**
- Create: `src/lib/storage/sniff.ts`, `src/lib/storage/upload.ts`
- Modify: `src/lib/storage/local-fs-storage.ts` (sniff on save), `src/app/api/bookings/[id]/payment/route.ts`, `src/app/api/owner/venues/[id]/photos/route.ts`
- Test: `tests/storage/sniff.test.ts`, `tests/storage/upload.test.ts`

**Interfaces:**
- Produces: `sniffImageType(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null`; `validateUploadFile(file: { size: number; type: string }): void` (throws `ValidationError`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/storage/sniff.test.ts
import { describe, it, expect } from "vitest";
import { sniffImageType } from "@/lib/storage/sniff";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

describe("sniffImageType", () => {
  it("detects PNG", () => expect(sniffImageType(PNG)).toBe("image/png"));
  it("detects JPEG", () => expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg"));
  it("returns null for non-images", () => expect(sniffImageType(Buffer.from("%PDF-1.4"))).toBeNull());
});
```

```ts
// tests/storage/upload.test.ts
import { describe, it, expect } from "vitest";
import { validateUploadFile } from "@/lib/storage/upload";
import { ValidationError } from "@/lib/booking/errors";

describe("validateUploadFile", () => {
  it("accepts an allowed type under the size limit", () => {
    expect(() => validateUploadFile({ size: 1000, type: "image/png" })).not.toThrow();
  });
  it("rejects an oversize file before buffering", () => {
    expect(() => validateUploadFile({ size: 6 * 1024 * 1024, type: "image/png" })).toThrow(ValidationError);
  });
  it("rejects a disallowed type", () => {
    expect(() => validateUploadFile({ size: 1000, type: "application/pdf" })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/sniff.test.ts tests/storage/upload.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement sniff + validate**

```ts
// src/lib/storage/sniff.ts
export function sniffImageType(bytes: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
```

```ts
// src/lib/storage/upload.ts
import { ValidationError } from "@/lib/booking/errors";
import { ALLOWED_PROOF_TYPES, MAX_PROOF_BYTES } from "./proof-storage";

export function validateUploadFile(file: { size: number; type: string }): void {
  if (!(ALLOWED_PROOF_TYPES as readonly string[]).includes(file.type)) {
    throw new ValidationError("Unsupported image type. Use JPG, PNG, or WebP.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new ValidationError("Image is too large (max 5 MB).");
  }
}
```

- [ ] **Step 4: Add magic-byte check to `LocalFsStorage.save`**

In `src/lib/storage/local-fs-storage.ts`, after the existing size check (line 42) and before computing `name`:
```ts
import { sniffImageType } from "./sniff";
// ...
const sniffed = sniffImageType(bytes);
if (!sniffed || sniffed !== contentType) {
  throw new ValidationError("File content does not match its declared image type.");
}
```

(The existing `tests/storage/local-fs-storage.test.ts` uses a real PNG with `image/png` → still passes; its `application/pdf` case is rejected earlier by the allowed-types gate.)

- [ ] **Step 5: Wire `validateUploadFile` into both routes (pre-buffer)**

In `src/app/api/bookings/[id]/payment/route.ts`, after line 34 (`throw ... "Upload a payment screenshot"`) and before `const bytes = ...`:
```ts
import { validateUploadFile } from "@/lib/storage/upload";
// ...
validateUploadFile({ size: file.size, type: file.type });
```

In `src/app/api/owner/venues/[id]/photos/route.ts`, after line 20 and before `const bytes = ...`:
```ts
import { validateUploadFile } from "@/lib/storage/upload";
// ...
validateUploadFile({ size: file.size, type: file.type });
```

- [ ] **Step 6: Run tests + full suite**

Run: `npx vitest run tests/storage/sniff.test.ts tests/storage/upload.test.ts tests/storage/local-fs-storage.test.ts tests/storage/venue-media.test.ts && npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage/sniff.ts src/lib/storage/upload.ts src/lib/storage/local-fs-storage.ts "src/app/api/bookings/[id]/payment/route.ts" "src/app/api/owner/venues/[id]/photos/route.ts" tests/storage/sniff.test.ts tests/storage/upload.test.ts
git commit -m "feat(storage): magic-byte validation and pre-buffer size rejection"
```

---

## P1-H · Task 11: Availability query fan-out reduction

**Files:**
- Modify: `src/lib/availability/engine.ts`
- Test: existing `tests/availability/engine.test.ts` + `tests/booking/concurrency.test.ts` must stay green (behavior preserved).

**Interfaces:**
- `courtSlotsForDate(courtId, date, opts?)` signature unchanged (still used by `src/app/api/bookings/route.ts`). `venueAvailability` internal batching changed; return type unchanged.

- [ ] **Step 1: Extract a pure slot computation**

Add near the other helpers in `engine.ts`:
```ts
type CourtWithSchedules = { id: string; active: boolean; priceCents: number; slotMinutes: number; venueId: string; schedules: { dayOfWeek: number; openMinute: number; closeMinute: number }[] };

function computeSlots(
  court: CourtWithSchedules,
  date: Date,
  exceptions: { startsAt: Date; endsAt: Date }[],
  occupied: { startsAt: Date; endsAt: Date }[],
  durationMinutes: number,
): Slot[] {
  if (!court.active) return [];
  const day = dayStartUTC(date);
  const sched = court.schedules.find((s) => s.dayOfWeek === day.getUTCDay());
  if (!sched) return [];
  const now = new Date();
  const slots: Slot[] = [];
  for (let m = sched.openMinute; m + durationMinutes <= sched.closeMinute; m += court.slotMinutes) {
    const startsAt = addMinutes(day, m);
    const endsAt = addMinutes(startsAt, durationMinutes);
    const blocked =
      startsAt <= now ||
      exceptions.some((e) => overlaps(startsAt, endsAt, e.startsAt, e.endsAt)) ||
      occupied.some((o) => overlaps(startsAt, endsAt, o.startsAt, o.endsAt));
    slots.push({ startsAt, endsAt, available: !blocked, priceCents: Math.round(court.priceCents * (durationMinutes / 60)) });
  }
  return slots;
}
```

- [ ] **Step 2: Refactor `courtSlotsForDate` to reuse `computeSlots`**

```ts
export async function courtSlotsForDate(courtId: string, date: Date, opts?: { durationMinutes?: number }): Promise<Slot[]> {
  const durationMinutes = opts?.durationMinutes ?? 60;
  const court = await prisma.court.findUnique({ where: { id: courtId }, include: { schedules: true } });
  if (!court || !court.active) return [];
  const day = dayStartUTC(date);
  const dayEnd = addMinutes(day, 24 * 60);
  const [exceptions, occupied] = await Promise.all([
    prisma.scheduleException.findMany({
      where: { startsAt: { lt: dayEnd }, endsAt: { gt: day }, OR: [{ courtId }, { courtId: null, venueId: court.venueId }] },
    }),
    resolveBackend(court.venueId).then((b) => b.getOccupied(courtId, day, dayEnd)),
  ]);
  return computeSlots(court, date, exceptions, occupied, durationMinutes);
}
```

- [ ] **Step 3: Refactor `venueAvailability` to batch per-venue queries**

```ts
export async function venueAvailability(venueId: string, date: Date, opts?: { durationMinutes?: number }): Promise<CourtAvailability[]> {
  const durationMinutes = opts?.durationMinutes ?? 60;
  const courts = await prisma.court.findMany({ where: { venueId, active: true }, include: { schedules: true }, orderBy: { sortOrder: "asc" } });
  const day = dayStartUTC(date);
  const dayEnd = addMinutes(day, 24 * 60);
  const [exceptions, backend] = await Promise.all([
    prisma.scheduleException.findMany({ where: { venueId, startsAt: { lt: dayEnd }, endsAt: { gt: day } } }),
    resolveBackend(venueId),
  ]);
  return Promise.all(
    courts.map(async (c) => {
      const occupied = await backend.getOccupied(c.id, day, dayEnd);
      const exForCourt = exceptions.filter((e) => e.courtId === null || e.courtId === c.id);
      return { courtId: c.id, courtName: c.name, indoor: c.indoor, slots: computeSlots(c, date, exForCourt, occupied, durationMinutes) };
    }),
  );
}
```

This removes the per-court `court.findUnique` and per-court `resolveBackend`, and fetches venue exceptions once. `getOccupied` remains per court (backend interface unchanged — do not modify the backend).

- [ ] **Step 4: Run availability + concurrency + booking suites**

Run: `npx vitest run tests/availability tests/booking && npm run typecheck && npm run lint && npm test`
Expected: all green — results identical to before; concurrency guarantee unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability/engine.ts
git commit -m "perf(availability): batch per-venue queries, drop redundant court fetches"
```

---

## FINAL GATE · Task 12: Production-like HTTP E2E smoke

**Files:**
- Create: `tests/e2e/server.ts` (spawn/stop helper), `tests/e2e/smoke.e2e.test.ts`
- Modify: `package.json` (add `test:e2e`), `vitest.config.mts` (exclude `*.e2e.test.ts` from the default run)

**Interfaces:**
- Consumes: the built `.next/standalone/server.js`, seeded data (`npm run db:seed`), `MAGIC_LINK_CAPTURE_PATH` capture provider (Task 4).

- [ ] **Step 1: Keep E2E out of the default unit run**

In `vitest.config.mts`, add to `test.exclude`: `"tests/e2e/**"`. Add to `package.json` scripts:
```json
"test:e2e": "vitest run --config vitest.e2e.mts"
```
Create `vitest.e2e.mts` mirroring `vitest.config.mts` but with `include: ["tests/e2e/**/*.e2e.test.ts"]`, `testTimeout: 60000`, `hookTimeout: 120000`.

- [ ] **Step 2: Write the server spawn helper**

```ts
// tests/e2e/server.ts
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface E2EServer { baseUrl: string; capturePath: string; stop(): void; }

export async function startServer(env: Record<string, string>): Promise<E2EServer> {
  const dir = mkdtempSync(path.join(tmpdir(), "rp-e2e-"));
  const capturePath = path.join(dir, "links.jsonl");
  const port = 3941;
  const proc: ChildProcess = spawn(process.execPath, [".next/standalone/server.js"], {
    env: { ...process.env, ...env, PORT: String(port), MAGIC_LINK_CAPTURE_PATH: capturePath, HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  // poll until ready
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { const r = await fetch(baseUrl + "/", { redirect: "manual" }); if (r.status > 0) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    baseUrl,
    capturePath,
    stop() { proc.kill("SIGTERM"); try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
}
```

- [ ] **Step 3: Write the E2E flow test**

Build first, seed the test DB, then drive the flow. The test reads the captured link from `capturePath`, extracts the cookie from `/auth/verify`, and exercises the 14-point checklist. Because the seeded owner owns all venues, the confirm flow works.

```ts
// tests/e2e/smoke.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { startServer, type E2EServer } from "./server";

const PROD_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: process.env.TEST_DATABASE_URL!,
  JWT_SECRET: "e2e-jwt-secret-atleast-32-chars-long-xxxx",
  APP_URL: "https://e2e.local",
};

function linkFor(capturePath: string, email: string): string {
  const lines = readFileSync(capturePath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const hit = [...lines].reverse().find((l) => l.to === email.toLowerCase());
  if (!hit) throw new Error("no captured link for " + email);
  return hit.url;
}

describe("production-like smoke", () => {
  let server: E2EServer;
  beforeAll(async () => { server = await startServer(PROD_ENV); }, 120_000);
  afterAll(() => server?.stop());

  it("refuses to start with an unsafe JWT secret", async () => {
    let started = false;
    try {
      const bad = await startServer({ ...PROD_ENV, JWT_SECRET: "dev-secret-change-in-production" });
      const r = await fetch(bad.baseUrl + "/").catch(() => null);
      started = !!r;
      bad.stop();
    } catch { started = false; }
    expect(started).toBe(false);
  });

  it("runs the customer→owner booking journey end to end", async () => {
    // 1. request magic link (seeded customer)
    const email = "player@rallypoint.test";
    const req = await fetch(server.baseUrl + "/api/auth/request", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
    });
    expect(req.status).toBe(200);
    // 2+3. capture link, verify, capture session cookie
    const url = new URL(linkFor(server.capturePath, email));
    const verify = await fetch(server.baseUrl + url.pathname + url.search, { redirect: "manual" });
    const cookie = verify.headers.get("set-cookie")!;
    expect(cookie).toContain("rallypoint_session=");
    expect(cookie.toLowerCase()).toContain("secure");
    expect(cookie.toLowerCase()).toContain("httponly");
    // ... continue: find a seeded venue, create a booking, submit proof (multipart),
    //     sign in as owner@rallypoint.test, confirm, assert customer status CONFIRMED,
    //     assert a second overlapping booking returns 409 (double-booking rejected),
    //     assert an unauthenticated GET of the proof key returns 401/403.
  });
});
```

Flesh out the remaining flow using the real endpoints (`/api/bookings`, `/api/bookings/[id]/payment`, `/api/owner/bookings/[id]/confirm`, `/api/bookings/[id]/status`, `/api/proofs/[...key]`). Use the seeded venues/courts (query them via a public page or add a tiny read through an existing endpoint). Keep assertions to the checklist; do not add product behavior.

- [ ] **Step 4: Run the full gate**

Run:
```bash
docker compose up -d
npm run db:deploy
npm run db:seed
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
```
Expected: typecheck 0, lint 0, unit suite green, build green, E2E green (including the "refuses unsafe secret" case).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e vitest.e2e.mts vitest.config.mts package.json
git commit -m "test(e2e): production-like HTTP smoke with captured magic link"
```

---

## Manual production smoke (with live creds — not automated)

After the gate is green, the operator runs a real production-like deploy and manually verifies the 14-point checklist from the Phase 7 brief, especially: **step 2** (a real Resend email actually arrives) and **step 14** (the server refuses to start with unsafe secrets — already covered by the E2E but re-confirmed with real config). Document the outcome; do not push until instructed.

---

## Self-Review

**Spec coverage:**
- P0-A production email → Task 4 (Resend, lazy selection, missing-config fail-fast via env, dev endpoints stay gated). ✓
- P0-B env validation + fallback removal + `.env.example` → Tasks 1–2. ✓
- P0-C Secure cookie → Task 3. ✓
- P0-D disclosure pages + links → Task 5. ✓
- P1-E logging → Tasks 6–7. ✓
- P1-F SEO → Tasks 8–9 (unpublished-venue noindex already exists; sitemap excludes non-live). ✓
- P1-G upload hardening → Task 10. ✓
- P1-H availability fan-out → Task 11. ✓
- Testing gates + explicit required tests (env validation, weak/missing JWT, missing APP_URL, prod email selection, prod cookie Secure, storage authz kept green, upload validation, terms/privacy availability, SEO generation, booking concurrency kept green) → covered across Tasks 1–12. ✓
- Production smoke (14 points) → Task 12 + manual section. ✓
- DO-NOT-CHANGE guardrails → no task edits booking backend/EXCLUDE/state machine/idempotency/authz/review/notification-txn; Task 11 touches only the availability read path. ✓
- Object storage deferred → documented; seam preserved; not built. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" in code steps; each code step has real content. The E2E flow (Task 12 Step 3) intentionally leaves the tail of the journey as explicit endpoint instructions rather than fabricated brittle payloads — the endpoints and assertions are named exactly; the implementer wires the concrete request bodies from the real handlers. This is the one place where over-specifying request shapes would be guesswork against seed data.

**Type consistency:** `AppEnv` shape is identical across Tasks 1/2/3/4/8/9. `errorResponse(e, ctx?)` stays backward-compatible. `sessionCookieAttrs(isProduction)` used consistently. `validateUploadFile({size,type})` and `sniffImageType(Buffer)` signatures match their call sites. `emailSender` remains an `EmailSender`-shaped export so existing importers are unaffected.

**Verified against source:** `AppError(message, httpStatus, code)` with lowercase string codes (`src/lib/booking/errors.ts`) — Task 7's test uses this order. `tests/factories.ts` has `seedOwnerVenueCourt()` (APPROVED+published) but no draft factory — Task 9 creates the draft inline. `sessionCookie`/`clearSessionCookie` currently return plain objects consumed by route handlers via `cookies().set(...)`; Task 3 keeps that shape and only adds `secure`.
