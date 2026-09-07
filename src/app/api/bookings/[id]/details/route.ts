import { NextRequest, NextResponse } from "next/server";
import { bookingBackend } from "@/lib/booking";
import { ValidationError } from "@/lib/booking/errors";
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
    const body = (await req.json()) as { name?: string; mobile?: string; email?: string };
    if (!body.name?.trim() || !body.mobile?.trim()) {
      throw new ValidationError("Name and mobile number are required");
    }
    await bookingBackend.submitDetails(
      id,
      {
        name: body.name.trim(),
        mobile: body.mobile.trim(),
        email: body.email?.trim() || booking.customerEmail || session.email,
      },
      { type: session.role as ActorKind, id: session.id },
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
