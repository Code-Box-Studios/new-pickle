import prisma from "@/lib/prisma";
import { resolveBackend } from "@/lib/booking/resolve";
import type { Court, CourtSchedule } from "@/generated/prisma";
import { HOLD_PHASE, OCCUPYING } from "@/lib/booking/status";
import { bookingWallNow } from "./time";

/**
 * Availability derives from three sources, unified:
 *   court schedule (weekday window)  −  schedule exceptions  −  occupying bookings
 *
 * Times are treated as wall-clock stored in UTC (Davao is UTC+8, no DST). The UI
 * formats these instants in UTC so the wall-clock a venue configured is what a
 * player sees. A per-venue timezone is a later concern.
 */

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  available: boolean;
  priceCents: number;
}

export interface CourtAvailability {
  courtId: string;
  courtName: string;
  indoor: boolean;
  slots: Slot[];
}

export interface VenueSearchResult {
  venue: {
    id: string;
    slug: string;
    name: string;
    city: string;
    barangay: string | null;
    photos: string[];
    amenities: string[];
    ratingAvg: number;
    ratingCount: number;
    indoor: boolean;
  };
  priceFromCents: number | null;
  courtCount: number;
  nextSlots: Slot[];
}

export interface SearchQuery {
  city: string;
  date: Date;
  fromMinute?: number;
  toMinute?: number;
  durationMinutes?: number;
  indoor?: boolean;
}

function dayStartUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

type Range = { startsAt: Date; endsAt: Date };
function slotsForCourt(
  court: Court & { schedules: CourtSchedule[] },
  day: Date,
  durationMinutes: number,
  exceptions: Range[],
  occupied: Range[],
  now: Date,
): Slot[] {
  const sched = court.schedules.find((s) => s.dayOfWeek === day.getUTCDay());
  if (!sched || court.slotMinutes <= 0 || durationMinutes <= 0) return [];
  const slots: Slot[] = [];
  for (
    let m = sched.openMinute;
    m + durationMinutes <= sched.closeMinute;
    m += court.slotMinutes
  ) {
    const startsAt = addMinutes(day, m),
      endsAt = addMinutes(startsAt, durationMinutes);
    const blocked =
      startsAt <= now ||
      exceptions.some((e) =>
        overlaps(startsAt, endsAt, e.startsAt, e.endsAt),
      ) ||
      occupied.some((o) => overlaps(startsAt, endsAt, o.startsAt, o.endsAt));
    slots.push({
      startsAt,
      endsAt,
      available: !blocked,
      priceCents: Math.round(court.priceCents * (durationMinutes / 60)),
    });
  }
  return slots;
}

export async function courtSlotsForDate(
  courtId: string,
  date: Date,
  opts?: { durationMinutes?: number },
): Promise<Slot[]> {
  const durationMinutes = opts?.durationMinutes ?? 60;
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { schedules: true },
  });
  if (!court || !court.active) return [];

  const day = dayStartUTC(date);
  const weekday = day.getUTCDay();
  const sched = court.schedules.find((s) => s.dayOfWeek === weekday);
  if (!sched) return []; // closed that day

  const dayEnd = addMinutes(day, 24 * 60);
  const [exceptions, occupied] = await Promise.all([
    prisma.scheduleException.findMany({
      where: {
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
        // court-scoped OR venue-wide (courtId null) block
        OR: [{ courtId }, { courtId: null, venueId: court.venueId }],
      },
    }),
    resolveBackend(court.venueId).then((backend) =>
      backend.getOccupied(courtId, day, dayEnd),
    ),
  ]);

  return slotsForCourt(
    court,
    day,
    durationMinutes,
    exceptions,
    occupied,
    bookingWallNow(),
  );
}

export async function venueAvailability(
  venueId: string,
  date: Date,
  opts?: { durationMinutes?: number },
): Promise<CourtAvailability[]> {
  const courts = await prisma.court.findMany({
    where: { venueId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  return Promise.all(
    courts.map(async (c) => ({
      courtId: c.id,
      courtName: c.name,
      indoor: c.indoor,
      slots: await courtSlotsForDate(c.id, date, opts),
    })),
  );
}

function withinWindow(
  slot: Slot,
  day: Date,
  from?: number,
  to?: number,
): boolean {
  const mins = (slot.startsAt.getTime() - day.getTime()) / 60_000;
  return (from == null || mins >= from) && (to == null || mins < to);
}

export async function searchAvailability(
  q: SearchQuery,
): Promise<VenueSearchResult[]> {
  const venues = await prisma.venue.findMany({
    where: { city: q.city, isPublished: true, status: "APPROVED" },
    include: {
      courts: { where: { active: true }, include: { schedules: true } },
      sentry: { select: { connectionState: true } },
    },
  });
  const day = dayStartUTC(q.date),
    dayEnd = addMinutes(day, 1440),
    now = new Date();
  const localVenues = venues.filter(
    (v) => v.sentry?.connectionState !== "CONNECTED",
  );
  const localCourtIds = localVenues.flatMap((v) => v.courts.map((c) => c.id));
  const [blocks, bookings] = localCourtIds.length
    ? await Promise.all([
        prisma.scheduleException.findMany({
          where: {
            venueId: { in: localVenues.map((v) => v.id) },
            startsAt: { lt: dayEnd },
            endsAt: { gt: day },
          },
          select: {
            venueId: true,
            courtId: true,
            startsAt: true,
            endsAt: true,
          },
        }),
        prisma.booking.findMany({
          where: {
            courtId: { in: localCourtIds },
            status: { in: OCCUPYING },
            startsAt: { lt: dayEnd },
            endsAt: { gt: day },
            NOT: {
              AND: [
                { status: { in: HOLD_PHASE } },
                { holdExpiresAt: { lt: now } },
              ],
            },
          },
          select: { courtId: true, startsAt: true, endsAt: true },
        }),
      ])
    : [[], []];
  const courtBlocks = new Map<string, Range[]>(),
    venueBlocks = new Map<string, Range[]>(),
    occupied = new Map<string, Range[]>();
  for (const block of blocks) {
    const map = block.courtId ? courtBlocks : venueBlocks,
      key = block.courtId ?? block.venueId;
    map.set(key, [...(map.get(key) ?? []), block]);
  }
  for (const booking of bookings)
    occupied.set(booking.courtId, [
      ...(occupied.get(booking.courtId) ?? []),
      booking,
    ]);

  const results = await Promise.all(
    venues.map(async (v) => {
      const courtsFiltered =
        q.indoor == null
          ? v.courts
          : v.courts.filter((c) => c.indoor === q.indoor);
      const courtIds = new Set(courtsFiltered.map((c) => c.id));

      const avail =
        v.sentry?.connectionState === "CONNECTED"
          ? await venueAvailability(v.id, q.date, {
              durationMinutes: q.durationMinutes,
            })
          : courtsFiltered.map((c) => ({
              courtId: c.id,
              slots: slotsForCourt(
                c,
                day,
                q.durationMinutes ?? 60,
                [
                  ...(venueBlocks.get(v.id) ?? []),
                  ...(courtBlocks.get(c.id) ?? []),
                ],
                occupied.get(c.id) ?? [],
                bookingWallNow(now),
              ),
            }));

      const available = avail
        .filter((a) => courtIds.has(a.courtId))
        .flatMap((a) => a.slots)
        .filter(
          (s) => s.available && withinWindow(s, day, q.fromMinute, q.toMinute),
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      // Distinct start times for the "next free" chips.
      const seen = new Set<number>();
      const nextSlots: Slot[] = [];
      for (const s of available) {
        const t = s.startsAt.getTime();
        if (seen.has(t)) continue;
        seen.add(t);
        nextSlots.push(s);
        if (nextSlots.length >= 4) break;
      }

      const priceFromCents = courtsFiltered.length
        ? Math.min(...courtsFiltered.map((c) => c.priceCents))
        : null;

      return {
        venue: {
          id: v.id,
          slug: v.slug,
          name: v.name,
          city: v.city,
          barangay: v.barangay,
          photos: v.photos,
          amenities: v.amenities,
          ratingAvg: v.ratingAvg,
          ratingCount: v.ratingCount,
          indoor: courtsFiltered.some((c) => c.indoor),
        },
        priceFromCents,
        courtCount: courtsFiltered.length,
        nextSlots,
      } satisfies VenueSearchResult;
    }),
  );

  return results
    .filter((r) => r.courtCount > 0)
    .sort(
      (a, b) =>
        (b.nextSlots.length > 0 ? 1 : 0) - (a.nextSlots.length > 0 ? 1 : 0) ||
        b.venue.ratingAvg - a.venue.ratingAvg,
    );
}
