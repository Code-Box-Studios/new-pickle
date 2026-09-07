import { NextRequest, NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { createReview, updateReview } from "@/lib/review";
import { errorResponse } from "@/lib/http";

// Create a review for a booking the caller owns. venueId is derived server-side
// from the booking; the client never supplies it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireOwnBooking(id);
    const { rating, body } = (await req.json().catch(() => ({}))) as { rating?: unknown; body?: unknown };
    const review = await createReview({ bookingId: id, userId: session.id, rating: rating as number, body: body as string | null });
    return NextResponse.json({ review });
  } catch (e) {
    return errorResponse(e);
  }
}

// Edit the caller's own review for a booking they own. No review-id API exists.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session } = await requireOwnBooking(id);
    const { rating, body } = (await req.json().catch(() => ({}))) as { rating?: unknown; body?: unknown };
    const review = await updateReview({ bookingId: id, userId: session.id, rating: rating as number, body: body as string | null });
    return NextResponse.json({ review });
  } catch (e) {
    return errorResponse(e);
  }
}
