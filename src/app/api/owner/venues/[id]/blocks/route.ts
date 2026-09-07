import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/booking/errors";
import { requireOperationalOwnVenue } from "@/lib/api/owner-venue-access";
import { createBlock } from "@/lib/venue/blocks";
import { errorResponse } from "@/lib/http";
import type { ExceptionType } from "@/generated/prisma";

const TYPES: ExceptionType[] = ["MAINTENANCE", "HOLIDAY", "PRIVATE_EVENT", "CLOSURE", "TOURNAMENT"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireOperationalOwnVenue(id);
    const b = (await req.json()) as Record<string, unknown>;

    const courtId = b.courtId ? String(b.courtId) : null;
    if (courtId) {
      const c = await prisma.court.findUnique({ where: { id: courtId } });
      if (!c || c.venueId !== id) throw new NotFoundError("Court not found");
    }

    const startsAt = new Date(String(b.startsAt ?? ""));
    const endsAt = new Date(String(b.endsAt ?? ""));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new ValidationError("Invalid time range");
    }
    const type = TYPES.includes(b.type as ExceptionType) ? (b.type as ExceptionType) : "MAINTENANCE";

    const ex = await createBlock({
      venueId: id,
      courtId,
      startsAt,
      endsAt,
      type,
      reason: b.reason ? String(b.reason) : null,
    });
    return NextResponse.json({ id: ex.id });
  } catch (e) {
    return errorResponse(e);
  }
}
