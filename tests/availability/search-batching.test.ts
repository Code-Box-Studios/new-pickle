import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { newReference } from "@/lib/booking/reference";
import { searchAvailability } from "@/lib/availability/engine";
beforeEach(resetDb);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function setup() {
  const day = slot(4, 0).startsAt,
    venues = [];
  for (let i = 0; i < 3; i++) {
    const s = await seedOwnerVenueCourt();
    const extra = await prisma.court.create({
      data: {
        venueId: s.venueId,
        name: "Outdoor",
        priceCents: 30000,
        indoor: false,
      },
    });
    await prisma.courtSchedule.createMany({
      data: [s.courtId, extra.id].map((courtId) => ({
        courtId,
        dayOfWeek: day.getUTCDay(),
        openMinute: 540,
        closeMinute: 720,
      })),
    });
    venues.push({ ...s, extraId: extra.id });
  }
  return { day, venues };
}
describe("batched local search availability", () => {
  it("hides times that have already passed today in the Philippines", async () => {
    const s = await seedOwnerVenueCourt();
    await prisma.courtSchedule.create({
      data: {
        courtId: s.courtId,
        dayOfWeek: 1,
        openMinute: 480,
        closeMinute: 1320,
      },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T02:30:00Z")); // 10:30 AM Manila.
    const result = await searchAvailability({
      city: "Davao City",
      date: new Date("2026-10-05T00:00:00Z"),
    });
    expect(result[0].nextSlots[0].startsAt.getUTCHours()).toBe(11);
  });
  it("does not repeat court, backend or block reads for every court", async () => {
    const { day } = await setup();
    const courts = vi.spyOn(prisma.court, "findUnique"),
      exceptions = vi.spyOn(prisma.scheduleException, "findMany"),
      bookings = vi.spyOn(prisma.booking, "findMany"),
      connections = vi.spyOn(prisma.sentryConnection, "findUnique");
    const result = await searchAvailability({ city: "Davao City", date: day });
    expect(result).toHaveLength(3);
    expect(result[0].nextSlots.map((s) => s.startsAt.getUTCHours())).toEqual([
      9, 10, 11,
    ]);
    expect(courts).not.toHaveBeenCalled();
    expect(connections).not.toHaveBeenCalled();
    expect(exceptions).toHaveBeenCalledTimes(1);
    expect(bookings).toHaveBeenCalledTimes(1);
  });
  it("preserves court-specific and venue-wide blocks and ignores expired holds", async () => {
    const { day, venues } = await setup(),
      a = venues[0];
    const at = (hour: number) => new Date(day.getTime() + hour * 3600000);
    await prisma.scheduleException.createMany({
      data: [
        {
          venueId: a.venueId,
          courtId: a.courtId,
          startsAt: at(10),
          endsAt: at(11),
          type: "MAINTENANCE",
        },
        {
          venueId: a.venueId,
          courtId: null,
          startsAt: at(11),
          endsAt: at(12),
          type: "CLOSURE",
        },
      ],
    });
    await prisma.booking.create({
      data: {
        reference: newReference(),
        venueId: a.venueId,
        courtId: a.extraId,
        startsAt: at(9),
        endsAt: at(10),
        status: "CONFIRMED",
        priceCents: 30000,
      },
    });
    await prisma.booking.create({
      data: {
        reference: newReference(),
        venueId: venues[1].venueId,
        courtId: venues[1].courtId,
        startsAt: at(9),
        endsAt: at(10),
        status: "HELD",
        holdExpiresAt: new Date(Date.now() - 1000),
        priceCents: 40000,
      },
    });
    const result = await searchAvailability({ city: "Davao City", date: day });
    expect(
      result
        .find((r) => r.venue.id === a.venueId)
        ?.nextSlots.map((s) => s.startsAt.getUTCHours()),
    ).toEqual([9, 10]);
    expect(
      result
        .find((r) => r.venue.id === venues[1].venueId)
        ?.nextSlots[0].startsAt.getUTCHours(),
    ).toBe(9);
    expect(result.find((r) => r.venue.id === a.venueId)?.priceFromCents).toBe(
      30000,
    );
    const longer = await searchAvailability({
      city: "Davao City",
      date: day,
      durationMinutes: 120,
    });
    expect(
      longer.find((r) => r.venue.id === a.venueId)?.nextSlots,
    ).toHaveLength(0);
  });
  it("keeps time windows, indoor filtering and session totals correct", async () => {
    const { day } = await setup();
    const result = await searchAvailability({
      city: "Davao City",
      date: day,
      durationMinutes: 120,
      indoor: true,
      fromMinute: 600,
      toMinute: 660,
    });
    expect(result).toHaveLength(3);
    expect(result[0].courtCount).toBe(1);
    expect(
      result[0].nextSlots.map((s) => [
        s.startsAt.getUTCHours(),
        s.endsAt.getUTCHours(),
        s.priceCents,
      ]),
    ).toEqual([[10, 12, 80000]]);
  });
});
