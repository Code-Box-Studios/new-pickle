import { NextRequest, NextResponse } from "next/server";
import { resolveBackend } from "@/lib/booking/resolve";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { errorResponse } from "@/lib/http";
import type { ActorKind } from "@/lib/booking/backend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, booking } = await requireOwnBooking(id);
    const backend = await resolveBackend(booking.venueId);
    await backend.cancel(id, { type: session.role as ActorKind, id: session.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
