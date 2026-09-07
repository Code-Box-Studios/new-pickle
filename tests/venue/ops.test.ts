import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt } from "../factories";
import { createBlock } from "@/lib/venue/blocks";
import { ownerDaySchedule } from "@/lib/venue/ops";
import { newReference } from "@/lib/booking/reference";

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

describe("ownerDaySchedule", () => {
  it("maps confirmed bookings, blocks, available and closed cells", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    const day = nextWeekday(1); // Monday
    await prisma.courtSchedule.create({ data: { courtId, dayOfWeek: 1, openMinute: 8 * 60, closeMinute: 22 * 60 } });
    await prisma.booking.create({
      data: { reference: newReference(), venueId, courtId, startsAt: at(day, 19), endsAt: at(day, 20), status: "CONFIRMED", priceCents: 40000 },
    });
    await createBlock({ venueId, courtId, startsAt: at(day, 12), endsAt: at(day, 14), type: "MAINTENANCE" });

    const sched = await ownerDaySchedule(venueId, day);
    const court = sched.courts.find((c) => c.id === courtId)!;
    const cell = (h: number) => court.cells.find((c) => new Date(c.startsAt).getUTCHours() === h)!;

    expect(sched.openMinute).toBe(8 * 60);
    expect(sched.closeMinute).toBe(22 * 60);
    expect(cell(19).state).toBe("CONFIRMED");
    expect(cell(19).reference).toBeTruthy();
    expect(cell(12).state).toBe("BLOCKED");
    expect(cell(13).state).toBe("BLOCKED");
    expect(cell(9).state).toBe("AVAILABLE");
  });
});
