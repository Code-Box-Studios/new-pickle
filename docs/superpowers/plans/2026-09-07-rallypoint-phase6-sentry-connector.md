# Phase 6 — Sentry Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SentryBookingBackend` behind the existing `BookingBackend` seam so a Sentry-connected venue is searched/booked through the same routes and UI as a local venue — without touching the local engine and without inventing an unverified Sentry HTTP contract.

**Architecture:** Ports & adapters. A RallyPoint-normalized `SentryClient` port has two implementations: a fully-tested in-memory `MockSentryClient` and an explicitly-unverified `HttpSentryClient` (throws `SentryContractUnavailableError`). `SentryBookingBackend` depends only on the port and implements `getOccupied`/`createHold`/`cancel`/`getStatus`; a `resolveBackend(venueId)` picks Local vs Sentry from `SentryConnection.connectionState`. A `backendType` discriminator marks Sentry index rows so they are never treated as locally authoritative.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Prisma 5.22, PostgreSQL 16, Vitest 5, `node:crypto` (AES-256-GCM).

## Global Constraints

- Prisma pinned to **5.22**; apply migrations with **`npm run db:deploy`** then **`npm run db:generate`** — never `prisma migrate dev` (raw-SQL tsrange/EXCLUDE causes benign drift). Postgres on host port **55432**.
- **Do not modify or weaken `LocalBookingBackend`, the booking state machine, the conflict model, or the `bookings_no_overlap` EXCLUDE constraint.** The only edit to Local is adding a trivial `getStatus`.
- **No invented Sentry wire contract.** The `SentryClient` port is RallyPoint-normalized. `HttpSentryClient` methods throw `SentryContractUnavailableError` with a `TODO(real-contract)` note — no fabricated URLs/JSON/state strings.
- Sentry adapter implements **only** `getOccupied`, `createHold`, `cancel`, `getStatus`. `submitPayment`/`confirm`/`reject`/`complete`/`reschedule`/`createWalkIn`/`submitDetails` throw `SentryUnsupportedOperationError`; `expireStale` returns `0`.
- Backend selection: `resolveBackend(venueId)` → Sentry when `SentryConnection.connectionState === "CONNECTED"`, else the local singleton.
- Never expose credentials/base URL/secrets to the browser or in error responses.
- Search availability may use the short-TTL `cached()`; **createHold and getStatus must not use the availability cache.**
- All Phase 1–5 tests remain untouched and green. No existing test is replaced with a Sentry mock.
- Error classes (`src/lib/booking/errors.ts`): `AppError(message, httpStatus, code)`, `ValidationError` (400), `NotFoundError` (404), `SlotTakenError` (409), `ConflictError` (409). `errorResponse` maps `AppError` → JSON.
- `BackendType` enum values: `LOCAL`, `SENTRY`. Env var: `SENTRY_CRED_SECRET` (dev fallback), `SENTRY_MODE` (`mock` selects `MockSentryClient` in the factory).
- Verification gate: `npm run typecheck` = 0, `npm run lint` = 0, `npm test` green, `npm run build` green, plus the HTTP e2e in Task 12. Commit locally after each task. **Do not push.**

---

## File Structure

**Create:**
- `src/lib/sentry/port.ts` — `SentryClient` interface + normalized types (`ExternalBookingState`, `SentryResource`, `SentryBusyRange`, `SentryBooking`, `SentryCreateBookingInput`).
- `src/lib/sentry/errors.ts` — normalized Sentry error taxonomy.
- `src/lib/sentry/credentials.ts` — `CredentialCipher` (AES-256-GCM).
- `src/lib/sentry/mapping.ts` — pure mappers (state→status, busy→occupied, holdInput→createBooking).
- `src/lib/sentry/mock-client.ts` — `MockSentryClient` (reference impl + fault knobs).
- `src/lib/sentry/http-client.ts` — `HttpSentryClient` (unverified skeleton).
- `src/lib/sentry/factory.ts` — `sentryClientForVenue(venueId)`.
- `src/lib/sentry/index.ts` — re-exports.
- `src/lib/booking/sentry-backend.ts` — `SentryBookingBackend`.
- `src/lib/booking/resolve.ts` — `resolveBackend(venueId)`.
- `docs/superpowers/specs/2026-09-07-rallypoint-phase6-sentry-contract.md` — assumed/unverified contract + status/error mapping doc.
- Migration `prisma/migrations/20260907170000_sentry_connector/migration.sql`.
- Tests: `tests/sentry/credentials.test.ts`, `mapping.test.ts`, `mock-client.test.ts`, `http-client.test.ts`, `adapter.test.ts`, `contract.test.ts`, `resolve.test.ts`.

**Modify:**
- `prisma/schema.prisma` — `BackendType` enum; `Booking.backendType`/`externalRef`; `Court.externalRef`.
- `src/lib/booking/backend.ts` — add `getStatus` to `BookingBackend`.
- `src/lib/booking/local-backend.ts` — implement trivial `getStatus`.
- `src/lib/availability/engine.ts:95` — `courtSlotsForDate` uses `resolveBackend`.
- `src/app/api/bookings/route.ts:73` — `createHold` via `resolveBackend`.
- `src/app/api/bookings/[id]/cancel/route.ts` — cancel via `resolveBackend`.
- `src/app/api/bookings/[id]/details/route.ts` (or a new status route) — status refresh via `resolveBackend`. (Plan uses a new `GET` on the review-free status path — see Task 11.)
- `tests/factories.ts` — add `seedSentryVenue` helper.

---

# Phase 6A — Port, errors, credentials, mapping

### Task 1: SentryClient port + normalized types

**Files:**
- Create: `src/lib/sentry/port.ts`

**Interfaces:**
- Produces: `ExternalBookingState`, `SentryResource`, `SentryBusyRange`, `SentryBooking`, `SentryCreateBookingInput`, `SentryClient` (exact shapes below).

- [ ] **Step 1: Write the port**

Create `src/lib/sentry/port.ts`:

```ts
// The SentryClient port is expressed in RallyPoint-NORMALIZED terms, NOT in any
// Sentry wire format. A real HttpSentryClient must translate the (currently
// unavailable) Sentry API into these types; that translation is the documented
// TODO. MockSentryClient is the fully-tested reference implementation.

export type ExternalBookingState = "held" | "confirmed" | "cancelled" | "completed" | "rejected";

export interface SentryResource {
  externalRef: string;
  name: string;
  capacity?: number | null;
}

export interface SentryBusyRange {
  startsAt: Date;
  endsAt: Date;
}

export interface SentryBooking {
  externalRef: string;
  state: ExternalBookingState;
  startsAt: Date;
  endsAt: Date;
}

export interface SentryCreateBookingInput {
  resourceRef: string;
  startsAt: Date;
  endsAt: Date;
  customer: { name?: string | null; email?: string | null; mobile?: string | null };
  idempotencyKey?: string | null;
}

export interface SentryClient {
  authCheck(): Promise<void>;
  listResources(): Promise<SentryResource[]>;
  getAvailability(input: { resourceRef: string; from: Date; to: Date }): Promise<SentryBusyRange[]>;
  createBooking(input: SentryCreateBookingInput): Promise<SentryBooking>;
  getBooking(externalRef: string): Promise<SentryBooking>;
  cancelBooking(externalRef: string): Promise<SentryBooking>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sentry/port.ts
git commit -m "feat(sentry): normalized SentryClient port + types"
```

---

### Task 2: Sentry error taxonomy

**Files:**
- Create: `src/lib/sentry/errors.ts`

**Interfaces:**
- Consumes: `AppError` from `@/lib/booking/errors`.
- Produces: `SentryAuthError`, `SentryUnavailableError`, `SentryRateLimitError`, `SentryInvalidResourceError`, `SentryTimeoutError`, `SentryUnexpectedResponseError`, `SentryContractUnavailableError`, `SentryUnsupportedOperationError` (all extend `AppError`).

- [ ] **Step 1: Implement errors**

Create `src/lib/sentry/errors.ts`:

```ts
import { AppError } from "@/lib/booking/errors";

// All Sentry integration failures normalize to AppError subclasses so the API
// layer returns a safe status/message. Messages NEVER include credentials,
// base URLs, or raw upstream payloads.

export class SentryAuthError extends AppError {
  constructor(message = "Sentry authentication failed") {
    super(message, 502, "sentry_auth");
  }
}
export class SentryUnavailableError extends AppError {
  constructor(message = "Sentry is temporarily unavailable") {
    super(message, 503, "sentry_unavailable");
  }
}
export class SentryRateLimitError extends AppError {
  constructor(message = "Sentry rate limit reached, please retry shortly") {
    super(message, 503, "sentry_rate_limit");
  }
}
export class SentryInvalidResourceError extends AppError {
  constructor(message = "The requested resource is not available on Sentry") {
    super(message, 404, "sentry_invalid_resource");
  }
}
export class SentryTimeoutError extends AppError {
  constructor(message = "Sentry request timed out") {
    super(message, 504, "sentry_timeout");
  }
}
export class SentryUnexpectedResponseError extends AppError {
  constructor(message = "Sentry returned an unexpected response") {
    super(message, 502, "sentry_unexpected");
  }
}
export class SentryContractUnavailableError extends AppError {
  constructor(message = "Sentry HTTP contract is not available in this environment") {
    super(message, 501, "sentry_contract_unavailable");
  }
}
export class SentryUnsupportedOperationError extends AppError {
  constructor(message = "This action isn't supported for Sentry-connected venues in this phase") {
    super(message, 409, "sentry_unsupported");
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → 0 errors.

```bash
git add src/lib/sentry/errors.ts
git commit -m "feat(sentry): normalized error taxonomy"
```

---

### Task 3: Credential cipher (AES-256-GCM)

**Files:**
- Create: `src/lib/sentry/credentials.ts`
- Test: `tests/sentry/credentials.test.ts`

**Interfaces:**
- Produces: `credentialCipher.encrypt(plaintext: string): string`, `credentialCipher.decrypt(payload: string): string` (throws `ValidationError` on tamper/format failure).

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/credentials.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { credentialCipher } from "@/lib/sentry/credentials";
import { ValidationError } from "@/lib/booking/errors";

describe("credentialCipher", () => {
  it("round-trips a secret", () => {
    const secret = "sk_live_example_1234567890";
    const enc = credentialCipher.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(credentialCipher.decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(credentialCipher.encrypt("x")).not.toBe(credentialCipher.encrypt("x"));
  });

  it("rejects a tampered payload", () => {
    const enc = credentialCipher.encrypt("secret");
    const tampered = enc.slice(0, -2) + (enc.endsWith("aa") ? "bb" : "aa");
    expect(() => credentialCipher.decrypt(tampered)).toThrow(ValidationError);
  });

  it("rejects a malformed payload", () => {
    expect(() => credentialCipher.decrypt("not-a-valid-payload")).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sentry/credentials.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cipher**

Create `src/lib/sentry/credentials.ts`:

```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ValidationError } from "@/lib/booking/errors";

// AES-256-GCM. The 32-byte key is derived from SENTRY_CRED_SECRET (dev fallback,
// mirroring JWT_SECRET). Server-only; ciphertext is stored in
// SentryConnection.encryptedApiKey and never sent to the browser.
function key(): Buffer {
  const secret = process.env.SENTRY_CRED_SECRET ?? "dev-sentry-secret-change-in-production";
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new ValidationError("Invalid credential payload");
  try {
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new ValidationError("Could not decrypt credential");
  }
}

export const credentialCipher = { encrypt, decrypt };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/sentry/credentials.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/credentials.ts tests/sentry/credentials.test.ts
git commit -m "feat(sentry): AES-256-GCM credential cipher"
```

---

### Task 4: Mapping functions

**Files:**
- Create: `src/lib/sentry/mapping.ts`
- Test: `tests/sentry/mapping.test.ts`

**Interfaces:**
- Consumes: `ExternalBookingState`, `SentryBusyRange`, `SentryCreateBookingInput` from `./port`; `OccupiedRange`, `HoldInput` from `@/lib/booking/backend`; `BookingStatus` from `@/generated/prisma`.
- Produces:
  - `externalStateToStatus(state: ExternalBookingState): BookingStatus`
  - `busyRangesToOccupied(ranges: SentryBusyRange[]): OccupiedRange[]`
  - `holdInputToCreateBooking(input: HoldInput, resourceRef: string): SentryCreateBookingInput`

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/mapping.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { externalStateToStatus, busyRangesToOccupied, holdInputToCreateBooking } from "@/lib/sentry/mapping";

describe("sentry mapping", () => {
  it("maps every external state to a RallyPoint status", () => {
    expect(externalStateToStatus("held")).toBe("PENDING_CONFIRMATION");
    expect(externalStateToStatus("confirmed")).toBe("CONFIRMED");
    expect(externalStateToStatus("cancelled")).toBe("CANCELLED");
    expect(externalStateToStatus("completed")).toBe("COMPLETED");
    expect(externalStateToStatus("rejected")).toBe("REJECTED");
  });

  it("maps busy ranges to occupied ranges as CONFIRMED occupancy", () => {
    const a = new Date("2026-09-10T09:00:00Z");
    const b = new Date("2026-09-10T10:00:00Z");
    const occ = busyRangesToOccupied([{ startsAt: a, endsAt: b }]);
    expect(occ).toEqual([{ startsAt: a, endsAt: b, status: "CONFIRMED" }]);
  });

  it("maps a hold input to a create-booking request", () => {
    const startsAt = new Date("2026-09-10T09:00:00Z");
    const endsAt = new Date("2026-09-10T10:00:00Z");
    const req = holdInputToCreateBooking(
      { venueId: "v1", courtId: "c1", startsAt, endsAt, priceCents: 40000, idempotencyKey: "k1", customer: { name: "Ana", email: "a@t.test" } },
      "resource-9",
    );
    expect(req).toEqual({
      resourceRef: "resource-9",
      startsAt,
      endsAt,
      customer: { name: "Ana", email: "a@t.test", mobile: undefined },
      idempotencyKey: "k1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sentry/mapping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement mapping**

Create `src/lib/sentry/mapping.ts`:

```ts
import type { BookingStatus } from "@/generated/prisma";
import type { OccupiedRange, HoldInput } from "@/lib/booking/backend";
import type { ExternalBookingState, SentryBusyRange, SentryCreateBookingInput } from "./port";

// Documented mapping over the NORMALIZED port vocabulary only (not Sentry's real
// state strings, which are unavailable here).
const STATE_TO_STATUS: Record<ExternalBookingState, BookingStatus> = {
  held: "PENDING_CONFIRMATION",
  confirmed: "CONFIRMED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  rejected: "REJECTED",
};

export function externalStateToStatus(state: ExternalBookingState): BookingStatus {
  return STATE_TO_STATUS[state];
}

export function busyRangesToOccupied(ranges: SentryBusyRange[]): OccupiedRange[] {
  return ranges.map((r) => ({ startsAt: r.startsAt, endsAt: r.endsAt, status: "CONFIRMED" as BookingStatus }));
}

export function holdInputToCreateBooking(input: HoldInput, resourceRef: string): SentryCreateBookingInput {
  return {
    resourceRef,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    customer: {
      name: input.customer.name ?? undefined,
      email: input.customer.email ?? undefined,
      mobile: input.customer.mobile ?? undefined,
    },
    idempotencyKey: input.idempotencyKey ?? undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/sentry/mapping.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/mapping.ts tests/sentry/mapping.test.ts
git commit -m "feat(sentry): normalized state/occupancy/request mappers"
```

---

# Phase 6B — Clients (mock + http skeleton)

### Task 5: MockSentryClient (reference impl + fault knobs)

**Files:**
- Create: `src/lib/sentry/mock-client.ts`
- Test: `tests/sentry/mock-client.test.ts`

**Interfaces:**
- Consumes: `SentryClient` + types from `./port`; error classes from `./errors`.
- Produces: `class MockSentryClient implements SentryClient` with constructor `(opts?: { resources?: SentryResource[]; faults?: Partial<Record<"auth"|"timeout"|"rateLimit"|"unknownResource"|"conflict"|"badResponse", boolean>>; seedBusy?: Record<string, SentryBusyRange[]> })`; helper `bookings` accessor for assertions.

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/mock-client.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MockSentryClient } from "@/lib/sentry/mock-client";
import {
  SentryAuthError,
  SentryTimeoutError,
  SentryRateLimitError,
  SentryInvalidResourceError,
  SentryUnexpectedResponseError,
} from "@/lib/sentry/errors";
import { SlotTakenError } from "@/lib/booking/errors";

const RES = [{ externalRef: "r1", name: "Court 1" }];
const range = (h: number) => ({
  startsAt: new Date(`2026-09-10T0${h}:00:00Z`),
  endsAt: new Date(`2026-09-10T0${h + 1}:00:00Z`),
});

describe("MockSentryClient", () => {
  it("lists seeded resources and creates + fetches a booking", async () => {
    const c = new MockSentryClient({ resources: RES });
    expect((await c.listResources()).map((r) => r.externalRef)).toEqual(["r1"]);
    const b = await c.createBooking({ resourceRef: "r1", ...range(9), customer: {} });
    expect(b.state).toBe("confirmed");
    const got = await c.getBooking(b.externalRef);
    expect(got.externalRef).toBe(b.externalRef);
  });

  it("reports created bookings as busy", async () => {
    const c = new MockSentryClient({ resources: RES });
    await c.createBooking({ resourceRef: "r1", ...range(9), customer: {} });
    const busy = await c.getAvailability({ resourceRef: "r1", from: new Date("2026-09-10T00:00:00Z"), to: new Date("2026-09-11T00:00:00Z") });
    expect(busy).toHaveLength(1);
  });

  it("cancels a booking", async () => {
    const c = new MockSentryClient({ resources: RES });
    const b = await c.createBooking({ resourceRef: "r1", ...range(9), customer: {} });
    expect((await c.cancelBooking(b.externalRef)).state).toBe("cancelled");
  });

  it("rejects a conflicting booking with SlotTakenError", async () => {
    const c = new MockSentryClient({ resources: RES });
    await c.createBooking({ resourceRef: "r1", ...range(9), customer: {} });
    await expect(c.createBooking({ resourceRef: "r1", ...range(9), customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("is idempotent on repeated idempotencyKey", async () => {
    const c = new MockSentryClient({ resources: RES });
    const b1 = await c.createBooking({ resourceRef: "r1", ...range(9), customer: {}, idempotencyKey: "k1" });
    const b2 = await c.createBooking({ resourceRef: "r1", ...range(9), customer: {}, idempotencyKey: "k1" });
    expect(b2.externalRef).toBe(b1.externalRef);
  });

  it("maps fault knobs to normalized errors", async () => {
    await expect(new MockSentryClient({ faults: { auth: true } }).authCheck()).rejects.toBeInstanceOf(SentryAuthError);
    await expect(new MockSentryClient({ faults: { timeout: true }, resources: RES }).listResources()).rejects.toBeInstanceOf(SentryTimeoutError);
    await expect(new MockSentryClient({ faults: { rateLimit: true }, resources: RES }).listResources()).rejects.toBeInstanceOf(SentryRateLimitError);
    await expect(new MockSentryClient({ resources: RES }).getAvailability({ resourceRef: "nope", from: new Date(), to: new Date() })).rejects.toBeInstanceOf(SentryInvalidResourceError);
    await expect(new MockSentryClient({ faults: { badResponse: true }, resources: RES }).getBooking("x")).rejects.toBeInstanceOf(SentryUnexpectedResponseError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sentry/mock-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mock**

Create `src/lib/sentry/mock-client.ts`:

```ts
import type {
  SentryClient,
  SentryResource,
  SentryBusyRange,
  SentryBooking,
  SentryCreateBookingInput,
} from "./port";
import {
  SentryAuthError,
  SentryTimeoutError,
  SentryRateLimitError,
  SentryInvalidResourceError,
  SentryUnexpectedResponseError,
} from "./errors";
import { SlotTakenError } from "@/lib/booking/errors";

type Fault = "auth" | "timeout" | "rateLimit" | "unknownResource" | "conflict" | "badResponse";

interface Stored extends SentryBooking {
  resourceRef: string;
  idempotencyKey?: string | null;
}

let seq = 0;

// In-memory reference implementation of the SentryClient port. Also the "mock
// Sentry server" the SENTRY_MODE=mock factory returns for HTTP e2e.
export class MockSentryClient implements SentryClient {
  private resources: SentryResource[];
  private faults: Partial<Record<Fault, boolean>>;
  private store: Stored[] = [];

  constructor(opts?: {
    resources?: SentryResource[];
    faults?: Partial<Record<Fault, boolean>>;
    seedBusy?: Record<string, SentryBusyRange[]>;
  }) {
    this.resources = opts?.resources ?? [];
    this.faults = opts?.faults ?? {};
    for (const [resourceRef, ranges] of Object.entries(opts?.seedBusy ?? {})) {
      for (const r of ranges) {
        this.store.push({ externalRef: `seed-${(seq += 1)}`, resourceRef, state: "confirmed", startsAt: r.startsAt, endsAt: r.endsAt });
      }
    }
  }

  get bookings(): ReadonlyArray<Stored> {
    return this.store;
  }

  private guard() {
    if (this.faults.auth) throw new SentryAuthError();
    if (this.faults.timeout) throw new SentryTimeoutError();
    if (this.faults.rateLimit) throw new SentryRateLimitError();
    if (this.faults.badResponse) throw new SentryUnexpectedResponseError();
  }

  private resource(ref: string): SentryResource {
    const r = this.resources.find((x) => x.externalRef === ref);
    if (!r || this.faults.unknownResource) throw new SentryInvalidResourceError();
    return r;
  }

  async authCheck(): Promise<void> {
    this.guard();
  }

  async listResources(): Promise<SentryResource[]> {
    this.guard();
    return this.resources;
  }

  async getAvailability(input: { resourceRef: string; from: Date; to: Date }): Promise<SentryBusyRange[]> {
    this.guard();
    this.resource(input.resourceRef);
    return this.store
      .filter((b) => b.resourceRef === input.resourceRef && b.state !== "cancelled" && b.state !== "rejected")
      .filter((b) => b.startsAt < input.to && b.endsAt > input.from)
      .map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
  }

  async createBooking(input: SentryCreateBookingInput): Promise<SentryBooking> {
    this.guard();
    this.resource(input.resourceRef);
    if (input.idempotencyKey) {
      const existing = this.store.find((b) => b.idempotencyKey === input.idempotencyKey);
      if (existing) return this.view(existing);
    }
    const conflict = this.store.some(
      (b) => b.resourceRef === input.resourceRef && b.state !== "cancelled" && b.state !== "rejected" && b.startsAt < input.endsAt && b.endsAt > input.startsAt,
    );
    if (conflict || this.faults.conflict) throw new SlotTakenError();
    const booking: Stored = {
      externalRef: `mock-${(seq += 1)}`,
      resourceRef: input.resourceRef,
      state: "confirmed",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      idempotencyKey: input.idempotencyKey ?? null,
    };
    this.store.push(booking);
    return this.view(booking);
  }

  async getBooking(externalRef: string): Promise<SentryBooking> {
    this.guard();
    const b = this.store.find((x) => x.externalRef === externalRef);
    if (!b) throw new SentryInvalidResourceError("Unknown Sentry booking");
    return this.view(b);
  }

  async cancelBooking(externalRef: string): Promise<SentryBooking> {
    this.guard();
    const b = this.store.find((x) => x.externalRef === externalRef);
    if (!b) throw new SentryInvalidResourceError("Unknown Sentry booking");
    b.state = "cancelled";
    return this.view(b);
  }

  private view(b: Stored): SentryBooking {
    return { externalRef: b.externalRef, state: b.state, startsAt: b.startsAt, endsAt: b.endsAt };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/sentry/mock-client.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/mock-client.ts tests/sentry/mock-client.test.ts
git commit -m "feat(sentry): in-memory MockSentryClient reference + fault knobs"
```

---

### Task 6: HttpSentryClient (explicitly unverified skeleton)

**Files:**
- Create: `src/lib/sentry/http-client.ts`
- Test: `tests/sentry/http-client.test.ts`

**Interfaces:**
- Consumes: `SentryClient` from `./port`; `SentryContractUnavailableError` from `./errors`.
- Produces: `class HttpSentryClient implements SentryClient` constructed with `{ baseUrl: string; apiKey: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/http-client.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { HttpSentryClient } from "@/lib/sentry/http-client";
import { SentryContractUnavailableError } from "@/lib/sentry/errors";

describe("HttpSentryClient (unverified)", () => {
  const c = new HttpSentryClient({ baseUrl: "https://sentry.example", apiKey: "secret" });

  it("throws SentryContractUnavailableError for every operation", async () => {
    await expect(c.authCheck()).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.listResources()).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.getAvailability({ resourceRef: "r", from: new Date(), to: new Date() })).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.createBooking({ resourceRef: "r", startsAt: new Date(), endsAt: new Date(), customer: {} })).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.getBooking("x")).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.cancelBooking("x")).rejects.toBeInstanceOf(SentryContractUnavailableError);
  });

  it("never leaks the api key in the error message", async () => {
    const err = await c.authCheck().catch((e) => e as Error);
    expect(err.message).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sentry/http-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the skeleton**

Create `src/lib/sentry/http-client.ts`:

```ts
import type { SentryClient, SentryResource, SentryBusyRange, SentryBooking, SentryCreateBookingInput } from "./port";
import { SentryContractUnavailableError } from "./errors";

// UNVERIFIED. No live Sentry API or documented wire contract is available in
// this workspace, so this client intentionally implements nothing. When the real
// contract is available, each method below must:
//   TODO(real-contract): authenticate with `this.apiKey` (Bearer or per Sentry
//     spec), call the documented endpoint under `this.baseUrl`, apply an
//     AbortController timeout, translate the real Sentry response/state strings
//     into the normalized port types (ExternalBookingState etc.), and map HTTP
//     failures to the src/lib/sentry/errors.ts taxonomy.
// Until then every method throws SentryContractUnavailableError so nothing can
// silently depend on a fabricated contract.
export class HttpSentryClient implements SentryClient {
  constructor(private readonly config: { baseUrl: string; apiKey: string }) {}

  private unavailable(): never {
    // Note: never include this.config in the error — no secret/base-URL leakage.
    throw new SentryContractUnavailableError();
  }

  async authCheck(): Promise<void> {
    this.unavailable();
  }
  async listResources(): Promise<SentryResource[]> {
    this.unavailable();
  }
  async getAvailability(): Promise<SentryBusyRange[]> {
    this.unavailable();
  }
  async createBooking(_input: SentryCreateBookingInput): Promise<SentryBooking> {
    this.unavailable();
  }
  async getBooking(_ref: string): Promise<SentryBooking> {
    this.unavailable();
  }
  async cancelBooking(_ref: string): Promise<SentryBooking> {
    this.unavailable();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/sentry/http-client.test.ts`
Expected: PASS (2 tests). If lint flags unused params, prefix with `_` (already done) or keep the signature minimal.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/http-client.ts tests/sentry/http-client.test.ts
git commit -m "feat(sentry): explicit unverified HttpSentryClient skeleton"
```

---

# Phase 6C — Schema, adapter, resolver, factory

### Task 7: Schema — BackendType + externalRef columns

**Files:**
- Create: `prisma/migrations/20260907170000_sentry_connector/migration.sql`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `enum BackendType { LOCAL SENTRY }`; `Booking.backendType`, `Booking.externalRef`, `Court.externalRef`; regenerated client.

- [ ] **Step 1: Write the migration**

Create `prisma/migrations/20260907170000_sentry_connector/migration.sql`:

```sql
-- Phase 6: mark which backend owns a booking, and store Sentry external refs.
CREATE TYPE "BackendType" AS ENUM ('LOCAL', 'SENTRY');

ALTER TABLE "bookings" ADD COLUMN "backendType" "BackendType" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "bookings" ADD COLUMN "externalRef" TEXT;
CREATE INDEX "bookings_backendType_idx" ON "bookings" ("backendType");

ALTER TABLE "courts" ADD COLUMN "externalRef" TEXT;
```

- [ ] **Step 2: Update the schema**

In `prisma/schema.prisma`, add the enum near the other enums:

```prisma
enum BackendType {
  LOCAL
  SENTRY
}
```

In `model Court`, add after `sortOrder`:

```prisma
  externalRef String? // Sentry resource id (SENTRY venues only)
```

In `model Booking`, add after `source`:

```prisma
  backendType BackendType   @default(LOCAL)
  externalRef String? // Sentry booking id (SENTRY bookings only)
```

And add to the `Booking` indexes block:

```prisma
  @@index([backendType])
```

- [ ] **Step 3: Apply + regenerate**

Run: `npm run db:deploy && npm run db:generate`
Expected: migration `20260907170000_sentry_connector` applied; client regenerated.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260907170000_sentry_connector
git commit -m "feat(sentry): BackendType discriminator + externalRef columns"
```

---

### Task 8: getStatus on the interface + LocalBookingBackend

**Files:**
- Modify: `src/lib/booking/backend.ts`, `src/lib/booking/local-backend.ts`
- Test: `tests/sentry/adapter.test.ts` (create with the Local getStatus case; extended in Task 9)

**Interfaces:**
- Produces: `BookingBackend.getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }>`; `LocalBookingBackend.getStatus` reads the row.

- [ ] **Step 1: Extend the interface**

In `src/lib/booking/backend.ts`, add to the `BookingBackend` interface (after `getOccupied`):

```ts
  /** Current normalized status. LOCAL reads its own row; SENTRY refreshes from Sentry. */
  getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }>;
```

- [ ] **Step 2: Write the failing test**

Create `tests/sentry/adapter.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { NotFoundError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("LocalBookingBackend.getStatus", () => {
  it("returns the booking's current status and null externalRef", async () => {
    const s = await seedOneCourtSlot();
    const held = await bookingBackend.createHold({ ...s, customer: {} });
    const res = await bookingBackend.getStatus(held.id);
    expect(res.status).toBe("HELD");
    expect(res.externalRef).toBeNull();
  });

  it("throws NotFoundError for a missing booking", async () => {
    await expect(bookingBackend.getStatus("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/sentry/adapter.test.ts`
Expected: FAIL — `getStatus` not implemented on `LocalBookingBackend` (typecheck/runtime error).

- [ ] **Step 4: Implement Local getStatus**

In `src/lib/booking/local-backend.ts`, add a method to the class (e.g., after `getOccupied`):

```ts
  async getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }> {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, externalRef: true },
    });
    if (!b) throw new NotFoundError("Booking not found");
    return { status: b.status, externalRef: b.externalRef };
  }
```

(`BookingStatus` and `NotFoundError` are already imported in this file.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/sentry/adapter.test.ts && npm run typecheck`
Expected: PASS (2 tests); typecheck 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/booking/backend.ts src/lib/booking/local-backend.ts tests/sentry/adapter.test.ts
git commit -m "feat(sentry): add getStatus to BookingBackend + Local impl"
```

---

### Task 9: SentryBookingBackend

**Files:**
- Create: `src/lib/booking/sentry-backend.ts`
- Modify: `tests/sentry/adapter.test.ts` (extend with Sentry cases), `tests/factories.ts` (add `seedSentryVenue`)

**Interfaces:**
- Consumes: `BookingBackend`, `HoldInput`, `HeldBooking`, `Actor`, `OccupiedRange`, `WalkInInput`, `CustomerDetails`, `PaymentInput` from `./backend`; `SentryClient` from `@/lib/sentry/port`; mappers from `@/lib/sentry/mapping`; `SentryUnsupportedOperationError`, `SentryInvalidResourceError` from `@/lib/sentry/errors`; `newReference` from `./reference`; `prisma`.
- Produces: `class SentryBookingBackend implements BookingBackend` constructed with `(client: SentryClient)`.

- [ ] **Step 1: Add the `seedSentryVenue` factory**

In `tests/factories.ts`, append:

```ts
/** A CONNECTED Sentry venue: court carries an externalRef, connection is CONNECTED. */
export async function seedSentryVenue(opts?: { resourceRef?: string; priceCents?: number }) {
  const resourceRef = opts?.resourceRef ?? "r1";
  const base = await seedOwnerVenueCourt(opts);
  await prisma.court.update({ where: { id: base.courtId }, data: { externalRef: resourceRef } });
  await prisma.sentryConnection.create({
    data: { venueId: base.venueId, sentryBusinessRef: "biz-1", connectionState: "CONNECTED" },
  });
  const customer = await prisma.user.create({
    data: { email: `c-${randomUUID().slice(0, 8)}@t.test`, role: "CUSTOMER" },
  });
  return { ...base, resourceRef, customerId: customer.id };
}
```

(`randomUUID` is already imported at the top of `tests/factories.ts`.)

- [ ] **Step 2: Write the failing Sentry-adapter tests**

Append to `tests/sentry/adapter.test.ts`:

```ts
import { seedSentryVenue, slot } from "../factories";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { MockSentryClient } from "@/lib/sentry/mock-client";
import { SlotTakenError } from "@/lib/booking/errors";
import { SentryUnsupportedOperationError } from "@/lib/sentry/errors";
import { prisma } from "../db";

async function sentrySetup() {
  const v = await seedSentryVenue();
  const client = new MockSentryClient({ resources: [{ externalRef: v.resourceRef, name: "Court 1" }] });
  const backend = new SentryBookingBackend(client);
  return { v, client, backend };
}

describe("SentryBookingBackend", () => {
  it("createHold books via Sentry and writes a SENTRY index row", async () => {
    const { v, backend } = await sentrySetup();
    const held = await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, userId: v.customerId, customer: { email: "a@t.test" } });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: held.id } });
    expect(row.backendType).toBe("SENTRY");
    expect(row.externalRef).not.toBeNull();
    expect(row.status).toBe("CONFIRMED");
  });

  it("getOccupied reflects a Sentry booking", async () => {
    const { v, backend } = await sentrySetup();
    const s = slot();
    await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...s, priceCents: 40000, customer: {} });
    const occ = await backend.getOccupied(v.courtId, new Date(s.startsAt.getTime() - 3_600_000), new Date(s.endsAt.getTime() + 3_600_000));
    expect(occ).toHaveLength(1);
  });

  it("rejects a conflicting slot with SlotTakenError", async () => {
    const { v, backend } = await sentrySetup();
    const s = slot();
    await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...s, priceCents: 40000, customer: {} });
    await expect(backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...s, priceCents: 40000, customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("is idempotent on repeated idempotencyKey", async () => {
    const { v, backend } = await sentrySetup();
    const input = { venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, customer: {}, idempotencyKey: "k1" };
    const a = await backend.createHold(input);
    const b = await backend.createHold(input);
    expect(b.id).toBe(a.id);
  });

  it("cancel and getStatus round-trip through Sentry", async () => {
    const { v, backend } = await sentrySetup();
    const held = await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, customer: {} });
    await backend.cancel(held.id, { type: "CUSTOMER", id: v.customerId });
    const status = await backend.getStatus(held.id);
    expect(status.status).toBe("CANCELLED");
    expect(status.externalRef).not.toBeNull();
  });

  it("throws SentryUnsupportedOperationError for out-of-phase methods", async () => {
    const { backend } = await sentrySetup();
    await expect(backend.confirm("x", { type: "OWNER" })).rejects.toBeInstanceOf(SentryUnsupportedOperationError);
    await expect(backend.submitPayment("x", { channel: "GCASH", reference: "r", proofKey: "k", amountCents: 1 }, { type: "CUSTOMER" })).rejects.toBeInstanceOf(SentryUnsupportedOperationError);
    expect(await backend.expireStale()).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/sentry/adapter.test.ts`
Expected: FAIL — `SentryBookingBackend` not found.

- [ ] **Step 4: Implement the adapter**

Create `src/lib/booking/sentry-backend.ts`:

```ts
import type { BookingStatus } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { newReference } from "./reference";
import type { SentryClient } from "@/lib/sentry/port";
import { SentryInvalidResourceError, SentryUnsupportedOperationError } from "@/lib/sentry/errors";
import { busyRangesToOccupied, externalStateToStatus, holdInputToCreateBooking } from "@/lib/sentry/mapping";
import type {
  Actor,
  BookingBackend,
  CustomerDetails,
  HeldBooking,
  HoldInput,
  OccupiedRange,
  PaymentInput,
  WalkInInput,
} from "./backend";

// Sentry is authoritative for connected venues. The RallyPoint Booking row is an
// INDEX (backendType=SENTRY, externalRef, last-known status), never the authority.
export class SentryBookingBackend implements BookingBackend {
  constructor(private readonly client: SentryClient) {}

  private async resourceRef(courtId: string): Promise<string> {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { externalRef: true } });
    if (!court?.externalRef) throw new SentryInvalidResourceError("Court is not mapped to a Sentry resource");
    return court.externalRef;
  }

  async getOccupied(courtId: string, from: Date, to: Date): Promise<OccupiedRange[]> {
    const resourceRef = await this.resourceRef(courtId);
    const busy = await this.client.getAvailability({ resourceRef, from, to });
    return busyRangesToOccupied(busy);
  }

  async createHold(input: HoldInput): Promise<HeldBooking> {
    // Idempotency short-circuit against the local index (replay-safe).
    if (input.idempotencyKey) {
      const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        return { id: existing.id, reference: existing.reference, status: existing.status, holdExpiresAt: existing.holdExpiresAt };
      }
    }
    const resourceRef = await this.resourceRef(input.courtId);
    const remote = await this.client.createBooking(holdInputToCreateBooking(input, resourceRef));
    const status = externalStateToStatus(remote.state);
    const booking = await prisma.booking.create({
      data: {
        reference: newReference(),
        venueId: input.venueId,
        courtId: input.courtId,
        userId: input.userId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status,
        holdExpiresAt: null,
        priceCents: input.priceCents,
        source: "ONLINE",
        backendType: "SENTRY",
        externalRef: remote.externalRef,
        idempotencyKey: input.idempotencyKey ?? null,
        customerName: input.customer.name ?? null,
        customerMobile: input.customer.mobile ?? null,
        customerEmail: input.customer.email ?? null,
      },
    });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, toStatus: status, actor: "SYSTEM", note: "Created via Sentry" },
    });
    return { id: booking.id, reference: booking.reference, status: booking.status, holdExpiresAt: null };
  }

  async cancel(bookingId: string, actor: Actor): Promise<void> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { externalRef: true, status: true } });
    if (!b?.externalRef) throw new NotFoundError("Sentry booking not found");
    const remote = await this.client.cancelBooking(b.externalRef);
    const status = externalStateToStatus(remote.state);
    await prisma.booking.update({ where: { id: bookingId }, data: { status } });
    await prisma.bookingStatusHistory.create({
      data: { bookingId, fromStatus: b.status, toStatus: status, actor: actor.type, actorId: actor.id ?? null, note: "Cancelled via Sentry" },
    });
  }

  async getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { externalRef: true } });
    if (!b?.externalRef) throw new NotFoundError("Sentry booking not found");
    const remote = await this.client.getBooking(b.externalRef);
    const status = externalStateToStatus(remote.state);
    // Refresh ONLY the last-known local index state.
    await prisma.booking.update({ where: { id: bookingId }, data: { status } });
    return { status, externalRef: b.externalRef };
  }

  // --- Out-of-phase for Sentry venues (documented). ---
  async createWalkIn(_input: WalkInInput): Promise<HeldBooking> {
    throw new SentryUnsupportedOperationError();
  }
  async reschedule(_id: string, _s: Date, _e: Date, _a: Actor): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async submitDetails(_id: string, _c: CustomerDetails, _a: Actor): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async submitPayment(_id: string, _p: PaymentInput, _a: Actor): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async confirm(_id: string, _a: Actor): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async reject(_id: string, _a: Actor, _note?: string): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async complete(_id: string, _a: Actor): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async expireStale(_now?: Date): Promise<number> {
    return 0;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/sentry/adapter.test.ts && npm run typecheck`
Expected: PASS (all adapter tests); typecheck 0. If lint flags unused `_`-params, that is acceptable per repo config; if it errors, keep the leading underscore (repo convention allows unused args prefixed with `_`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/booking/sentry-backend.ts tests/sentry/adapter.test.ts tests/factories.ts
git commit -m "feat(sentry): SentryBookingBackend (getOccupied/createHold/cancel/getStatus)"
```

---

### Task 10: Factory + resolver

**Files:**
- Create: `src/lib/sentry/factory.ts`, `src/lib/sentry/index.ts`, `src/lib/booking/resolve.ts`
- Test: `tests/sentry/resolve.test.ts`

**Interfaces:**
- Consumes: `MockSentryClient`, `HttpSentryClient`, `credentialCipher`, `SentryClient`; `SentryBookingBackend`; local `bookingBackend`; `prisma`.
- Produces: `sentryClientForVenue(venueId): Promise<SentryClient>`; `resolveBackend(venueId): Promise<BookingBackend>`.

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/resolve.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedOwnerVenueCourt, seedSentryVenue } from "../factories";
import { resolveBackend } from "@/lib/booking/resolve";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { LocalBookingBackend } from "@/lib/booking/local-backend";

beforeEach(resetDb);

describe("resolveBackend", () => {
  it("returns Local for a venue with no Sentry connection", async () => {
    const v = await seedOwnerVenueCourt();
    expect(await resolveBackend(v.venueId)).toBeInstanceOf(LocalBookingBackend);
  });

  it("returns Sentry for a CONNECTED venue", async () => {
    process.env.SENTRY_MODE = "mock";
    const v = await seedSentryVenue();
    expect(await resolveBackend(v.venueId)).toBeInstanceOf(SentryBookingBackend);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sentry/resolve.test.ts`
Expected: FAIL — modules not found. (`LocalBookingBackend` is exported from `src/lib/booking/local-backend.ts`.)

- [ ] **Step 3: Implement factory + index**

Create `src/lib/sentry/factory.ts`:

```ts
import prisma from "@/lib/prisma";
import type { SentryClient } from "./port";
import { MockSentryClient } from "./mock-client";
import { HttpSentryClient } from "./http-client";
import { credentialCipher } from "./credentials";

// Returns a MockSentryClient when SENTRY_MODE=mock (dev + HTTP e2e), else a real
// (currently unverified) HttpSentryClient built from the venue's connection.
export async function sentryClientForVenue(venueId: string): Promise<SentryClient> {
  const conn = await prisma.sentryConnection.findUnique({ where: { venueId } });

  if (process.env.SENTRY_MODE === "mock") {
    const courts = await prisma.court.findMany({
      where: { venueId, externalRef: { not: null } },
      select: { externalRef: true, name: true },
    });
    return new MockSentryClient({
      resources: courts.map((c) => ({ externalRef: c.externalRef as string, name: c.name })),
    });
  }

  const apiKey = conn?.encryptedApiKey ? credentialCipher.decrypt(conn.encryptedApiKey) : "";
  const baseUrl = process.env.SENTRY_BASE_URL ?? "";
  return new HttpSentryClient({ baseUrl, apiKey });
}
```

Create `src/lib/sentry/index.ts`:

```ts
export * from "./port";
export * from "./errors";
export * from "./mapping";
export { credentialCipher } from "./credentials";
export { MockSentryClient } from "./mock-client";
export { HttpSentryClient } from "./http-client";
export { sentryClientForVenue } from "./factory";
```

- [ ] **Step 4: Implement the resolver**

Create `src/lib/booking/resolve.ts`:

```ts
import prisma from "@/lib/prisma";
import type { BookingBackend } from "./backend";
import { bookingBackend } from "./index";
import { SentryBookingBackend } from "./sentry-backend";
import { sentryClientForVenue } from "@/lib/sentry/factory";

// Choose the backend for a venue. SENTRY when its connection is CONNECTED, else
// the authoritative local singleton (unchanged).
export async function resolveBackend(venueId: string): Promise<BookingBackend> {
  const conn = await prisma.sentryConnection.findUnique({
    where: { venueId },
    select: { connectionState: true },
  });
  if (conn?.connectionState === "CONNECTED") {
    return new SentryBookingBackend(await sentryClientForVenue(venueId));
  }
  return bookingBackend;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/sentry/resolve.test.ts && npm run typecheck`
Expected: PASS (2 tests); typecheck 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sentry/factory.ts src/lib/sentry/index.ts src/lib/booking/resolve.ts tests/sentry/resolve.test.ts
git commit -m "feat(sentry): client factory + per-venue backend resolver"
```

---

# Phase 6D — Wire the resolver into the player flow

### Task 11: Route availability, createHold, cancel, and status through the resolver

**Files:**
- Modify: `src/lib/availability/engine.ts`, `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/cancel/route.ts`
- Create: `src/app/api/bookings/[id]/status/route.ts`

**Interfaces:**
- Consumes: `resolveBackend` from `@/lib/booking/resolve`.

- [ ] **Step 1: Availability engine uses the resolver**

In `src/lib/availability/engine.ts`, replace the `bookingBackend` import with the resolver and resolve per court's venue. Change the import line:

```ts
import { resolveBackend } from "@/lib/booking/resolve";
```

In `courtSlotsForDate`, replace the `bookingBackend.getOccupied(courtId, day, dayEnd)` call (inside the `Promise.all`) with:

```ts
    resolveBackend(court.venueId).then((backend) => backend.getOccupied(courtId, day, dayEnd)),
```

(For LOCAL venues this returns the same singleton and identical behavior.)

- [ ] **Step 2: Bookings POST uses the resolver**

In `src/app/api/bookings/route.ts`, replace the `import { bookingBackend } from "@/lib/booking";` with:

```ts
import { resolveBackend } from "@/lib/booking/resolve";
```

Replace `const held = await bookingBackend.createHold({` with:

```ts
    const backend = await resolveBackend(court.venueId);
    const held = await backend.createHold({
```

- [ ] **Step 3: Cancel route uses the resolver**

In `src/app/api/bookings/[id]/cancel/route.ts`, replace `import { bookingBackend } from "@/lib/booking";` with:

```ts
import { resolveBackend } from "@/lib/booking/resolve";
```

Replace the cancel call:

```ts
    const { session, booking } = await requireOwnBooking(id);
    const backend = await resolveBackend(booking.venueId);
    await backend.cancel(id, { type: session.role as ActorKind, id: session.id });
```

(`requireOwnBooking` already returns `{ session, booking }`; `booking.venueId` is available.)

- [ ] **Step 4: Add a status-refresh route**

Create `src/app/api/bookings/[id]/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { resolveBackend } from "@/lib/booking/resolve";
import { errorResponse } from "@/lib/http";

// Return the current normalized status. For SENTRY bookings this refreshes from
// Sentry (authoritative); for LOCAL it reads the row.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { booking } = await requireOwnBooking(id);
    const backend = await resolveBackend(booking.venueId);
    const status = await backend.getStatus(id);
    return NextResponse.json({ status });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 5: Typecheck + lint + regression**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 0 typecheck/lint; all tests green (Phase 1–5 unchanged — LOCAL venues still resolve to the local singleton).

- [ ] **Step 6: Commit**

```bash
git add src/lib/availability/engine.ts "src/app/api/bookings/route.ts" "src/app/api/bookings/[id]/cancel/route.ts" "src/app/api/bookings/[id]/status/route.ts"
git commit -m "feat(sentry): route availability/createHold/cancel/status through resolveBackend"
```

---

# Phase 6E — Contract parity, e2e, docs

### Task 12: Contract-parity tests (Local vs Sentry)

**Files:**
- Create: `tests/sentry/contract.test.ts`

**Interfaces:**
- Consumes: `LocalBookingBackend`, `SentryBookingBackend`, `MockSentryClient`, factories.

- [ ] **Step 1: Write the parity tests**

Create `tests/sentry/contract.test.ts`:

```ts
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot, seedSentryVenue, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { MockSentryClient } from "@/lib/sentry/mock-client";
import { SlotTakenError } from "@/lib/booking/errors";

beforeEach(resetDb);

// Behaviours both backends must satisfy (where applicable).
describe("BookingBackend contract parity", () => {
  it("LOCAL: createHold returns a HeldBooking and getStatus agrees", async () => {
    const s = await seedOneCourtSlot();
    const held = await bookingBackend.createHold({ ...s, customer: {} });
    expect(held.reference).toMatch(/^RP-/);
    expect((await bookingBackend.getStatus(held.id)).status).toBe(held.status);
  });

  it("SENTRY: createHold returns a HeldBooking and getStatus agrees", async () => {
    const v = await seedSentryVenue();
    const backend = new SentryBookingBackend(new MockSentryClient({ resources: [{ externalRef: v.resourceRef, name: "Court 1" }] }));
    const held = await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, customer: {} });
    expect(held.reference).toMatch(/^RP-/);
    expect((await backend.getStatus(held.id)).status).toBe(held.status);
  });

  it("both reject a double-booked slot with SlotTakenError", async () => {
    // LOCAL
    const s = await seedOneCourtSlot();
    await bookingBackend.createHold({ ...s, customer: {} });
    await expect(bookingBackend.createHold({ ...s, customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
    // SENTRY
    const v = await seedSentryVenue();
    const backend = new SentryBookingBackend(new MockSentryClient({ resources: [{ externalRef: v.resourceRef, name: "Court 1" }] }));
    const ss = slot();
    await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...ss, priceCents: 40000, customer: {} });
    await expect(backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...ss, priceCents: 40000, customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("SENTRY index rows are marked backendType=SENTRY; LOCAL rows stay LOCAL", async () => {
    const s = await seedOneCourtSlot();
    const local = await bookingBackend.createHold({ ...s, customer: {} });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: local.id } })).backendType).toBe("LOCAL");

    const v = await seedSentryVenue();
    const backend = new SentryBookingBackend(new MockSentryClient({ resources: [{ externalRef: v.resourceRef, name: "Court 1" }] }));
    const remote = await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, customer: {} });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: remote.id } })).backendType).toBe("SENTRY");
  });
});
```

- [ ] **Step 2: Run + commit**

Run: `npm test -- tests/sentry/contract.test.ts`
Expected: PASS.

```bash
git add tests/sentry/contract.test.ts
git commit -m "test(sentry): Local vs Sentry BookingBackend contract parity"
```

---

### Task 13: Full suite + static gate

**Files:** none (verification).

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all Phase 1–5 tests green **plus** `tests/sentry/*`. No Phase 1–5 test modified.

- [ ] **Step 2: Static gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: typecheck 0, lint 0, build succeeds (new `/api/bookings/[id]/status` route listed).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore(sentry): full suite + static gate green"
```

(If nothing changed, skip the commit.)

---

### Task 14: HTTP integration e2e (SENTRY_MODE=mock) + contract doc + honesty statement

**Files:**
- Create: `docs/superpowers/specs/2026-09-07-rallypoint-phase6-sentry-contract.md`
- (Throwaway e2e script under the scratchpad; removed after — not committed.)

**Interfaces:** exercises the real routes with `SENTRY_MODE=mock`.

- [ ] **Step 1: Write the contract/honesty doc**

Create `docs/superpowers/specs/2026-09-07-rallypoint-phase6-sentry-contract.md` with:
- The normalized port surface (from `port.ts`) as the RallyPoint-owned contract.
- The documented `ExternalBookingState → BookingStatus` table.
- The error taxonomy and what each maps to.
- An explicit "UNVERIFIED" section: the real Sentry HTTP endpoints/request/response/state strings are **not available** in this workspace; `HttpSentryClient` throws `SentryContractUnavailableError`; a future slice must implement it against the real contract + add live tests.
- The end-of-phase honesty statement (four bullets from the spec §11).

- [ ] **Step 2: Prepare a Sentry venue in the dev DB**

Start dev with the mock backend on port 3100:
Run (background): `SENTRY_MODE=mock APP_URL=http://localhost:3100 npx next dev -p 3100`
Then, via a scratchpad tsx script (using the generated Prisma client + `dotenv/config`): pick a published owner venue, set its first court's `externalRef` (e.g. `"r1"`), and upsert a `SentryConnection { connectionState: "CONNECTED", sentryBusinessRef: "biz-1" }` for it. Capture the venue slug + court id.

- [ ] **Step 3: Drive the player flow through the abstraction**

In the same script, using the dev magic-link login flow (POST `/api/auth/request` → GET `/api/dev/last-magic-link` → GET `/auth/verify?token=` with `redirect:"manual"` to capture the `rallypoint_session` cookie), as `player@rallypoint.test`:
1. GET `/venues/<slug>` → assert HTTP 200 and that court slots render (availability came through `SentryBookingBackend.getOccupied` via the mock).
2. POST `/api/bookings` `{ courtId, startsAt, durationMinutes }` for an open slot → assert 200 with a `reference`.
3. Assert in the DB the created booking has `backendType = "SENTRY"` and a non-null `externalRef`.
4. GET `/api/bookings/<id>/status` → assert 200 and a normalized status.
5. POST `/api/bookings` for the SAME slot again → assert 409 (`SlotTakenError` surfaced through the abstraction).
Cleanup: delete the created booking + its history/notifications, unset the court `externalRef`, delete the `SentryConnection`. Restore the dev DB.

- [ ] **Step 4: Run the e2e**

Run: `npx tsx <scratchpad>/phase6-e2e.mts`
Expected: all assertions pass — proving the same player search→book→status flow operates through the backend abstraction for a Sentry-backed venue with the UI/API contract unchanged. Stop the dev server; delete the script.

- [ ] **Step 5: Commit the doc**

```bash
git add docs/superpowers/specs/2026-09-07-rallypoint-phase6-sentry-contract.md
git commit -m "docs(sentry): normalized contract + explicit unverified/honesty statement"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- §1 connection model → uses existing `SentryConnection`; credential cipher Task 3; factory Task 10.
- §2 connection abstraction (auth/config/resource/availability/booking/status separated) → port Task 1, clients Tasks 5–6, factory Task 10.
- §3 resource mapping → `Court.externalRef` Task 7; `resourceToCourtPresentation`/`resourceRef` Tasks 4/9; RallyPoint metadata vs Sentry live state kept distinct.
- §4 availability → `getOccupied` Task 9; engine wiring Task 11.
- §5 booking creation (idempotency, validation, conflict, error normalization) → Task 9 + route Task 11.
- §6 booking status → `getStatus` Tasks 8–9; documented mapping Task 4; status route Task 11.
- §7 source of truth → `backendType` discriminator Task 7; index-not-authority in adapter Task 9.
- §8 error handling → taxonomy Task 2, mock knobs Task 5, adapter mapping Task 9.
- §9 caching → search-layer cache untouched; createHold/getStatus never use it (Tasks 9/11; `courtSlotsForDate` uncached).
- §10 tests (resource lookup, availability, creation, duplicate, unavailable, status, error mapping, auth failure, timeout, invalid resource, unauthorized) → Tasks 5/9/12; contract parity Task 12.
- Critical compatibility (Phase 1–5 green, local engine untouched) → Task 13; only additive `getStatus` on Local.
- No-live-claims + verification gate → Tasks 13–14 + honesty doc.

**Placeholder scan:** the only `TODO(real-contract)` markers are the intended, spec-mandated unverified HTTP skeleton (Task 6) — not gaps. No other placeholders.

**Type consistency:** `SentryClient` methods (`authCheck`/`listResources`/`getAvailability`/`createBooking`/`getBooking`/`cancelBooking`) are identical across port (Task 1), mock (Task 5), http (Task 6), and adapter (Task 9). `getStatus` returns `{ status: BookingStatus; externalRef: string | null }` in the interface (Task 8), Local (Task 8), and Sentry (Task 9). `externalStateToStatus` domain (`held|confirmed|cancelled|completed|rejected`) matches `ExternalBookingState` (Task 1) and the mock's emitted states (Task 5). `resolveBackend`/`sentryClientForVenue` signatures match across Tasks 10–11. Factories return `{ ownerId, venueId, courtId, resourceRef, customerId }` consumed consistently.
