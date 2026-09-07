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
