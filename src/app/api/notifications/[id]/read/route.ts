import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { notificationService } from "@/lib/notifications/service";
import { errorResponse } from "@/lib/http";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const cleared = await notificationService.markRead(session.id, id);
    return NextResponse.json({ ok: true, cleared });
  } catch (e) {
    return errorResponse(e);
  }
}
