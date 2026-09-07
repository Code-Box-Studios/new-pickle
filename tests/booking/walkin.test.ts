import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { ConflictError, SlotTakenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("walk-in bookings", () => {
  it("creates a walk-in directly as CONFIRMED (WALK_IN, no hold, no payment)", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const w = await bookingBackend.createWalkIn({
      venueId,
      courtId,
      ...slot(),
      priceCents: 40000,
      customer: { name: "Ana" },
      note: "Cash",
    });
    expect(w.status).toBe("CONFIRMED");
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: w.id } });
    expect(row.source).toBe("WALK_IN");
    expect(row.holdExpiresAt).toBeNull();
    expect(row.note).toBe("Cash");
    expect(await prisma.paymentSubmission.findUnique({ where: { bookingId: w.id } })).toBeNull();
    const hist = await prisma.bookingStatusHistory.findMany({ where: { bookingId: w.id } });
    expect(hist.map((h) => h.toStatus)).toEqual(["CONFIRMED"]);
  });

  it("walk-in conflicts with an existing online hold (same EXCLUDE constraint)", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const s = slot();
    await bookingBackend.createHold({ venueId, courtId, ...s, priceCents: 40000, customer: {} });
    await expect(
      bookingBackend.createWalkIn({ venueId, courtId, ...s, priceCents: 40000, customer: {} }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("online hold conflicts with an existing walk-in", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const s = slot();
    await bookingBackend.createWalkIn({ venueId, courtId, ...s, priceCents: 40000, customer: {} });
    await expect(
      bookingBackend.createHold({ venueId, courtId, ...s, priceCents: 40000, customer: {} }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("concurrent walk-ins on the same slot → exactly one wins", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const s = slot();
    const rs = await Promise.all(
      Array.from({ length: 6 }, () =>
        bookingBackend
          .createWalkIn({ venueId, courtId, ...s, priceCents: 40000, customer: {} })
          .then(() => "ok" as const)
          .catch((e) => (e instanceof SlotTakenError ? "taken" : "err")),
      ),
    );
    expect(rs.filter((r) => r === "ok")).toHaveLength(1);
    expect(rs.filter((r) => r === "taken")).toHaveLength(5);
  });
});

describe("reschedule", () => {
  it("moves a booking to a free slot", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = await bookingBackend.createWalkIn({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    const to = slot(3, 20, 1);
    await bookingBackend.reschedule(b.id, to.startsAt, to.endsAt, { type: "OWNER" });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.startsAt.toISOString()).toBe(to.startsAt.toISOString());
    expect(row.status).toBe("CONFIRMED");
  });

  it("rejects a reschedule into an occupied slot", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    await bookingBackend.createWalkIn({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    const b = await bookingBackend.createWalkIn({ venueId, courtId, ...slot(3, 20, 1), priceCents: 40000, customer: {} });
    const clash = slot(3, 19, 1);
    await expect(
      bookingBackend.reschedule(b.id, clash.startsAt, clash.endsAt, { type: "OWNER" }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("cannot reschedule a terminal booking", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = await bookingBackend.createWalkIn({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    await bookingBackend.cancel(b.id, { type: "OWNER" });
    const to = slot(4, 19, 1);
    await expect(
      bookingBackend.reschedule(b.id, to.startsAt, to.endsAt, { type: "OWNER" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
