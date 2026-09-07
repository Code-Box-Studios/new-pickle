import { NextRequest, NextResponse } from "next/server";
import { requireOwnVenue } from "@/lib/api/owner-venue-access";
import { submitVenueForReview } from "@/lib/venue/review";
import { errorResponse } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireOwnVenue(id);
    const { note } = (await req.json().catch(() => ({}))) as { note?: string };
    await submitVenueForReview(id, note ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
