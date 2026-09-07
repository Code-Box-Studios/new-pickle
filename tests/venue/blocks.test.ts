import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { assertNoBlockOverlap, createBlock, removeBlock } from "@/lib/venue/blocks";
import { courtSlotsForDate } from "@/lib/availability/engine";
import { ConflictError } from "@/lib/booking/errors";

beforeEach(resetDb);

function nextWeekday(target: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
function at(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setUTCHours(hour);
  return d;
}

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

  it("a court block makes the slot unavailable to players", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const day = nextWeekday(1);
    await prisma.courtSchedule.create({ data: { courtId, dayOfWeek: 1, openMinute: 8 * 60, closeMinute: 22 * 60 } });
    await createBlock({ venueId, courtId, startsAt: at(day, 13), endsAt: at(day, 15), type: "MAINTENANCE" });
    const slots = await courtSlotsForDate(courtId, day);
    expect(slots.find((s) => s.startsAt.getUTCHours() === 13)!.available).toBe(false);
    expect(slots.find((s) => s.startsAt.getUTCHours() === 14)!.available).toBe(false);
    expect(slots.find((s) => s.startsAt.getUTCHours() === 16)!.available).toBe(true);
  });

  it("a venue-wide block makes the slot unavailable to players", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const day = nextWeekday(1);
    await prisma.courtSchedule.create({ data: { courtId, dayOfWeek: 1, openMinute: 8 * 60, closeMinute: 22 * 60 } });
    await createBlock({ venueId, courtId: null, startsAt: at(day, 8), endsAt: at(day, 22), type: "CLOSURE" });
    const slots = await courtSlotsForDate(courtId, day);
    expect(slots.every((s) => !s.available)).toBe(true);
  });
});
