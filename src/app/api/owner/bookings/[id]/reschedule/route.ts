import { NextRequest, NextResponse } from "next/server";
import { bookingBackend } from "@/lib/booking";
import { ValidationError } from "@/lib/booking/errors";
import { requireVenueBooking } from "@/lib/api/owner-access";
import { assertNoBlockOverlap } from "@/lib/venue/blocks";
import { errorResponse } from "@/lib/http";
import type { ActorKind } from "@/lib/booking/backend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, booking } = await requireVenueBooking(id);
    const b = (await req.json()) as { startsAt?: string; durationMinutes?: number };

    const startsAt = new Date(String(b.startsAt ?? ""));
    if (Number.isNaN(startsAt.getTime())) throw new ValidationError("Invalid start time");
    const durationMinutes = Number(
      b.durationMinutes ?? (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
    );
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new ValidationError("Invalid duration");
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    await assertNoBlockOverlap(booking.venueId, booking.courtId, startsAt, endsAt);
    await bookingBackend.reschedule(id, startsAt, endsAt, { type: session.role as ActorKind, id: session.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
