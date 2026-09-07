import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/booking/errors";
import { reviewVenue } from "@/lib/venue/review";
import { errorResponse } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = await requireRole("ADMIN");
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
    if (!reason?.trim()) throw new ValidationError("A suspension reason is required");
    await reviewVenue(id, "SUSPENDED", admin.id, reason.trim(), new Date());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
