import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot, seedSentryVenue, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import type { BookingBackend } from "@/lib/booking/backend";
import { NotFoundError, SlotTakenError } from "@/lib/booking/errors";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { MockSentryClient } from "@/lib/sentry/mock-client";
import { SentryUnsupportedOperationError } from "@/lib/sentry/errors";

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

async function sentrySetup() {
  const v = await seedSentryVenue();
  const client = new MockSentryClient({ resources: [{ externalRef: v.resourceRef, name: "Court 1" }] });
  // Exercise through the interface (as routes do) so unsupported ops typecheck.
  const backend: BookingBackend = new SentryBookingBackend(client);
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
