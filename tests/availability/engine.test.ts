import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt } from "../factories";
import { courtSlotsForDate } from "@/lib/availability/engine";
import { newReference } from "@/lib/booking/reference";

beforeEach(resetDb);

/** Next future date landing on `target` weekday (0=Sun..6=Sat), at 00:00 UTC. */
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

function slotAtHour<T extends { startsAt: Date }>(slots: T[], hour: number): T | undefined {
  return slots.find((s) => s.startsAt.getUTCHours() === hour);
}

async function setup(dayWeekday = 1 /* Monday */) {
  const { venueId, courtId } = await seedOwnerVenueCourt();
  await prisma.courtSchedule.create({
    data: { courtId, dayOfWeek: dayWeekday, openMinute: 8 * 60, closeMinute: 22 * 60 },
  });
  return { venueId, courtId, day: nextWeekday(dayWeekday) };
}

describe("availability engine", () => {
  it("generates hourly slots across the operating window", async () => {
    const { courtId, day } = await setup();
    const slots = await courtSlotsForDate(courtId, day);
    // 08:00 .. 21:00 inclusive starts = 14 one-hour slots (last ends at 22:00).
    expect(slots).toHaveLength(14);
    expect(slotAtHour(slots, 8)!.available).toBe(true);
    expect(slotAtHour(slots, 21)!.available).toBe(true); // ends exactly at close
  });

  it("marks a slot unavailable when a confirmed booking overlaps it", async () => {
    const { venueId, courtId, day } = await setup();
    await prisma.booking.create({
      data: {
        reference: newReference(),
        venueId,
        courtId,
        startsAt: at(day, 19),
        endsAt: at(day, 20),
        status: "CONFIRMED",
        priceCents: 40000,
      },
    });
    const slots = await courtSlotsForDate(courtId, day);
    expect(slotAtHour(slots, 19)!.available).toBe(false);
    expect(slotAtHour(slots, 18)!.available).toBe(true);
    expect(slotAtHour(slots, 20)!.available).toBe(true);
  });

  it("marks maintenance-exception slots unavailable", async () => {
    const { courtId, day } = await setup();
    await prisma.scheduleException.create({
      data: { courtId, startsAt: at(day, 12), endsAt: at(day, 14), type: "MAINTENANCE" },
    });
    const slots = await courtSlotsForDate(courtId, day);
    expect(slotAtHour(slots, 12)!.available).toBe(false);
    expect(slotAtHour(slots, 13)!.available).toBe(false);
    expect(slotAtHour(slots, 11)!.available).toBe(true);
    expect(slotAtHour(slots, 14)!.available).toBe(true);
  });

  it("respects duration when generating slots (no slot spilling past close)", async () => {
    const { courtId, day } = await setup();
    const slots = await courtSlotsForDate(courtId, day, { durationMinutes: 120 });
    // Last 2h slot starts at 20:00 (ends 22:00); no 21:00 start exists.
    expect(slotAtHour(slots, 20)).toBeTruthy();
    expect(slotAtHour(slots, 21)).toBeUndefined();
    // Price scales with duration.
    expect(slotAtHour(slots, 8)!.priceCents).toBe(80000);
  });

  it("returns no slots on a day with no schedule", async () => {
    const { courtId } = await setup(1);
    const tuesday = nextWeekday(2);
    expect(await courtSlotsForDate(courtId, tuesday)).toHaveLength(0);
  });
});
