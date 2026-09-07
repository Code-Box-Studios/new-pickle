import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { reviewVenue } from "@/lib/venue/review";
import { errorResponse } from "@/lib/http";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireRole("ADMIN");
    await reviewVenue(id, "APPROVED", admin.id, null, new Date());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
