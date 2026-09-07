import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { InvalidTransitionError, SlotTakenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("LocalBookingBackend", () => {
  it("creates a HELD booking with a hold expiry and an RP reference", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = await bookingBackend.createHold({
      venueId,
      courtId,
      ...slot(),
      priceCents: 40000,
      customer: {},
    });
    expect(b.status).toBe("HELD");
    expect(b.reference).toMatch(/^RP-[A-Z0-9]{6}$/);
    expect(b.holdExpiresAt).toBeInstanceOf(Date);
    expect(b.holdExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects an overlapping hold with SlotTakenError", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    await bookingBackend.createHold({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    await expect(
      bookingBackend.createHold({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("allows adjacent (half-open) holds on the same court", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    await bookingBackend.createHold({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    const adj = await bookingBackend.createHold({ venueId, courtId, ...slot(3, 20, 1), priceCents: 40000, customer: {} });
    expect(adj.status).toBe("HELD");
  });

  it("walks the happy path and records full status history", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, customer: { name: "Juan" } });
    await bookingBackend.submitDetails(b.id, { name: "Juan", mobile: "0917", email: "j@t.test" }, { type: "CUSTOMER" });
    await bookingBackend.submitPayment(
      b.id,
      { channel: "GCASH", reference: "REF1", proofKey: "payment-proofs/x.png", amountCents: 40000 },
      { type: "CUSTOMER" },
    );

    let row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("PENDING_CONFIRMATION");
    expect(row.holdExpiresAt).toBeNull();

    await bookingBackend.confirm(b.id, { type: "OWNER" });
    row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("CONFIRMED");

    const history = await prisma.bookingStatusHistory.findMany({
      where: { bookingId: b.id },
      orderBy: { at: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "HELD",
      "PENDING_PAYMENT",
      "PAYMENT_SUBMITTED",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
    ]);
  });

  it("rejects an illegal transition (confirming a bare HELD)", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, customer: {} });
    await expect(bookingBackend.confirm(b.id, { type: "OWNER" })).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("reports occupied ranges but not cancelled/expired ones", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const s = slot(3, 19, 1);
    const b = await bookingBackend.createHold({ venueId, courtId, ...s, priceCents: 40000, customer: {} });
    let occ = await bookingBackend.getOccupied(courtId, slot(3, 0, 0).startsAt, slot(4, 0, 0).startsAt);
    expect(occ).toHaveLength(1);
    await bookingBackend.cancel(b.id, { type: "CUSTOMER" });
    occ = await bookingBackend.getOccupied(courtId, slot(3, 0, 0).startsAt, slot(4, 0, 0).startsAt);
    expect(occ).toHaveLength(0);
  });
});
