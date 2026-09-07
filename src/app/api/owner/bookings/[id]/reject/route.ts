import { NextRequest, NextResponse } from "next/server";
import { bookingBackend } from "@/lib/booking";
import { requireVenueBooking } from "@/lib/api/owner-access";
import { errorResponse } from "@/lib/http";
import type { ActorKind } from "@/lib/booking/backend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireVenueBooking(id);
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    await bookingBackend.reject(
      id,
      { type: session.role as ActorKind, id: session.id },
      body.note,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
