import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";

interface DayInput {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
}

// Venue-wide weekly hours applied to every active court (per-court overrides deferred).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireEditableOwnVenue(id);
    const b = (await req.json()) as { days?: DayInput[] };
    const days = (b.days ?? []).filter(
      (d) =>
        Number.isInteger(d.dayOfWeek) &&
        d.dayOfWeek >= 0 &&
        d.dayOfWeek <= 6 &&
        Number.isFinite(d.openMinute) &&
        Number.isFinite(d.closeMinute) &&
        d.openMinute < d.closeMinute,
    );

    const courts = await prisma.court.findMany({
      where: { venueId: id, active: true },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const c of courts) {
        await tx.courtSchedule.deleteMany({ where: { courtId: c.id } });
        if (days.length) {
          await tx.courtSchedule.createMany({
            data: days.map((d) => ({
              courtId: c.id,
              dayOfWeek: d.dayOfWeek,
              openMinute: d.openMinute,
              closeMinute: d.closeMinute,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true, courts: courts.length, days: days.length });
  } catch (e) {
    return errorResponse(e);
  }
}
