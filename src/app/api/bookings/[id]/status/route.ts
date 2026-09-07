import { NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { resolveBackend } from "@/lib/booking/resolve";
import { errorResponse } from "@/lib/http";

// Return the current normalized status. requireOwnBooking enforces that the
// caller owns the booking (or is admin) BEFORE any read/refresh — a user must
// not be able to query another customer's booking status. For SENTRY bookings
// this refreshes from Sentry (authoritative); for LOCAL it reads the row.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { booking } = await requireOwnBooking(id);
    const backend = await resolveBackend(booking.venueId);
    const status = await backend.getStatus(id);
    return NextResponse.json({ status });
  } catch (e) {
    return errorResponse(e);
  }
}
