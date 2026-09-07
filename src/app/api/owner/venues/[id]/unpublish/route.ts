import { NextRequest, NextResponse } from "next/server";
import { requireOwnVenue } from "@/lib/api/owner-venue-access";
import { unpublishVenue } from "@/lib/venue/publish";
import { errorResponse } from "@/lib/http";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireOwnVenue(id);
    await unpublishVenue(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
