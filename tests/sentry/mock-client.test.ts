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
  startsAt: new Date(`2026-09-10T${String(h).padStart(2, "0")}:00:00Z`),
  endsAt: new Date(`2026-09-10T${String(h + 1).padStart(2, "0")}:00:00Z`),
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
