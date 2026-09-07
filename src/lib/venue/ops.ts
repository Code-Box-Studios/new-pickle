import prisma from "@/lib/prisma";
import { HOLD_PHASE, OCCUPYING } from "@/lib/booking/status";
import type { BookingStatus } from "@/generated/prisma";

export type CellState =
  | "AVAILABLE"
  | "HELD"
  | "PENDING"
  | "CONFIRMED"
  | "BLOCKED"
  | "CLOSED";

export interface DayCell {
  startMinute: number;
  startsAt: string;
  endsAt: string;
  state: CellState;
  bookingId?: string;
  reference?: string;
  label?: string;
}
export interface DayCourt {
  id: string;
  name: string;
  cells: DayCell[];
}
export interface OwnerDaySchedule {
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  courts: DayCourt[];
}

function dayStartUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function overlaps(aS: Date, aE: Date, bS: Date, bE: Date): boolean {
  return aS < bE && aE > bS;
}
function pendingGroup(s: BookingStatus): CellState {
  if (s === "HELD") return "HELD";
  if (s === "CONFIRMED") return "CONFIRMED";
  return "PENDING"; // PENDING_PAYMENT | PAYMENT_SUBMITTED | PENDING_CONFIRMATION
}

/** Owner day grid: per court, one cell per operating hour, each with a state. */
export async function ownerDaySchedule(venueId: string, date: Date): Promise<OwnerDaySchedule> {
  const day = dayStartUTC(date);
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60_000);
  const weekday = day.getUTCDay();
  const now = new Date();

  const courts = await prisma.court.findMany({
    where: { venueId, active: true },
    orderBy: { sortOrder: "asc" },
    include: { schedules: true },
  });

  const windows = courts
    .map((c) => c.schedules.find((s) => s.dayOfWeek === weekday))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const openMinute = windows.length ? Math.min(...windows.map((w) => w.openMinute)) : 0;
  const closeMinute = windows.length ? Math.max(...windows.map((w) => w.closeMinute)) : 0;

  const [bookings, exceptions] = await Promise.all([
    prisma.booking.findMany({
      where: {
        venueId,
        status: { in: OCCUPYING },
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
        NOT: { AND: [{ status: { in: HOLD_PHASE } }, { holdExpiresAt: { lt: now } }] },
      },
      select: { id: true, courtId: true, startsAt: true, endsAt: true, status: true, reference: true, customerName: true },
    }),
    prisma.scheduleException.findMany({
      where: { venueId, startsAt: { lt: dayEnd }, endsAt: { gt: day } },
      select: { courtId: true, startsAt: true, endsAt: true, type: true, reason: true },
    }),
  ]);

  const courtsOut: DayCourt[] = courts.map((court) => {
    const win = court.schedules.find((s) => s.dayOfWeek === weekday);
    const cells: DayCell[] = [];
    for (let m = openMinute; m + 60 <= closeMinute; m += 60) {
      const startsAt = new Date(day.getTime() + m * 60_000);
      const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
      const inWindow = !!win && win.openMinute <= m && win.closeMinute >= m + 60;

      const booking = bookings.find(
        (b) => b.courtId === court.id && overlaps(startsAt, endsAt, b.startsAt, b.endsAt),
      );
      const block = exceptions.find(
        (e) => (e.courtId === court.id || e.courtId === null) && overlaps(startsAt, endsAt, e.startsAt, e.endsAt),
      );

      let state: CellState;
      let bookingId: string | undefined;
      let reference: string | undefined;
      let label: string | undefined;
      if (booking) {
        state = pendingGroup(booking.status);
        bookingId = booking.id;
        reference = booking.reference;
        label = booking.customerName ?? booking.reference;
      } else if (block) {
        state = "BLOCKED";
        label = block.reason ?? block.type.toLowerCase();
      } else {
        state = inWindow ? "AVAILABLE" : "CLOSED";
      }

      cells.push({
        startMinute: m,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        state,
        bookingId,
        reference,
        label,
      });
    }
    return { id: court.id, name: court.name, cells };
  });

  return { openMinute, closeMinute, slotMinutes: 60, courts: courtsOut };
}

export interface AgendaItem {
  startsAt: string;
  endsAt: string;
  courtName: string;
  state: CellState;
  reference?: string;
  label: string;
}
export interface AgendaDay {
  date: string; // ISO date (UTC day)
  items: AgendaItem[];
}

/** Week agenda: 7 days from weekStart, each a time-sorted list of bookings + blocks. */
export async function ownerWeekAgenda(venueId: string, weekStart: Date): Promise<AgendaDay[]> {
  const start = dayStartUTC(weekStart);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
  const now = new Date();

  const courts = await prisma.court.findMany({ where: { venueId }, select: { id: true, name: true } });
  const courtName = new Map(courts.map((c) => [c.id, c.name]));

  const [bookings, exceptions] = await Promise.all([
    prisma.booking.findMany({
      where: {
        venueId,
        status: { in: OCCUPYING },
        startsAt: { lt: end, gte: start },
        NOT: { AND: [{ status: { in: HOLD_PHASE } }, { holdExpiresAt: { lt: now } }] },
      },
      select: { courtId: true, startsAt: true, endsAt: true, status: true, reference: true, customerName: true },
    }),
    prisma.scheduleException.findMany({
      where: { venueId, startsAt: { lt: end }, endsAt: { gt: start } },
      select: { courtId: true, startsAt: true, endsAt: true, type: true, reason: true },
    }),
  ]);

  const days: AgendaDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60_000);
    const dEnd = new Date(d.getTime() + 24 * 60 * 60_000);
    const items: AgendaItem[] = [];

    for (const b of bookings) {
      if (overlaps(b.startsAt, b.endsAt, d, dEnd)) {
        items.push({
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          courtName: courtName.get(b.courtId) ?? "Court",
          state: pendingGroup(b.status),
          reference: b.reference,
          label: b.customerName ?? b.reference,
        });
      }
    }
    for (const e of exceptions) {
      if (overlaps(e.startsAt, e.endsAt, d, dEnd)) {
        items.push({
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          courtName: e.courtId ? (courtName.get(e.courtId) ?? "Court") : "All courts",
          state: "BLOCKED",
          label: e.reason ?? e.type.toLowerCase(),
        });
      }
    }
    items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    days.push({ date: d.toISOString().slice(0, 10), items });
  }
  return days;
}
