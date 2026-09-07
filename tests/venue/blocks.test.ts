import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { assertNoBlockOverlap, createBlock, removeBlock } from "@/lib/venue/blocks";
import { ConflictError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("court blocking", () => {
  it("a court block makes overlapping times blocked, others free", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const b = slot(3, 12, 2); // 12:00–14:00
    await createBlock({ venueId, courtId, startsAt: b.startsAt, endsAt: b.endsAt, type: "MAINTENANCE", reason: "Resurfacing" });

    const inside = slot(3, 13, 1);
    await expect(assertNoBlockOverlap(venueId, courtId, inside.startsAt, inside.endsAt)).rejects.toBeInstanceOf(ConflictError);
    const outside = slot(3, 15, 1);
    await expect(assertNoBlockOverlap(venueId, courtId, outside.startsAt, outside.endsAt)).resolves.toBeUndefined();
  });

  it("a venue-wide block (courtId null) covers the court", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const whole = slot(3, 8, 14); // 08:00–22:00
    await createBlock({ venueId, courtId: null, startsAt: whole.startsAt, endsAt: whole.endsAt, type: "CLOSURE" });
    const t = slot(3, 13, 1);
    await expect(assertNoBlockOverlap(venueId, courtId, t.startsAt, t.endsAt)).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to create a block overlapping an active booking", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    await bookingBackend.createWalkIn({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, customer: {} });
    const over = slot(3, 18, 2); // 18:00–20:00 overlaps 19:00
    await expect(
      createBlock({ venueId, courtId, startsAt: over.startsAt, endsAt: over.endsAt, type: "MAINTENANCE" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("removes a block", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const s = slot(3, 12, 1);
    const block = await createBlock({ venueId, courtId, startsAt: s.startsAt, endsAt: s.endsAt, type: "MAINTENANCE" });
    await removeBlock(block.id);
    expect(await prisma.scheduleException.findUnique({ where: { id: block.id } })).toBeNull();
  });
});
