import { NextRequest, NextResponse } from "next/server";
import { bookingBackend } from "@/lib/booking";
import { requireVenueBooking } from "@/lib/api/owner-access";
import { errorResponse } from "@/lib/http";
import type { ActorKind } from "@/lib/booking/backend";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireVenueBooking(id);
    await bookingBackend.complete(id, { type: session.role as ActorKind, id: session.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
