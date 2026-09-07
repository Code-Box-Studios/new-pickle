import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot, seedSentryVenue, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { MockSentryClient } from "@/lib/sentry/mock-client";
import { SlotTakenError } from "@/lib/booking/errors";

beforeEach(resetDb);

function sentryBackendFor(resourceRef: string) {
  return new SentryBookingBackend(new MockSentryClient({ resources: [{ externalRef: resourceRef, name: "Court 1" }] }));
}

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
    const backend = sentryBackendFor(v.resourceRef);
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
    const backend = sentryBackendFor(v.resourceRef);
    const ss = slot();
    await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...ss, priceCents: 40000, customer: {} });
    await expect(backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...ss, priceCents: 40000, customer: {} })).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("SENTRY index rows are marked backendType=SENTRY; LOCAL rows stay LOCAL", async () => {
    const s = await seedOneCourtSlot();
    const local = await bookingBackend.createHold({ ...s, customer: {} });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: local.id } })).backendType).toBe("LOCAL");

    const v = await seedSentryVenue();
    const backend = sentryBackendFor(v.resourceRef);
    const remote = await backend.createHold({ venueId: v.venueId, courtId: v.courtId, ...slot(), priceCents: 40000, customer: {} });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: remote.id } })).backendType).toBe("SENTRY");
  });
});
