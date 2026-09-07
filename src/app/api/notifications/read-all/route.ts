import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { notificationService } from "@/lib/notifications/service";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const session = await requireUser();
    const cleared = await notificationService.markAllRead(session.id);
    return NextResponse.json({ ok: true, cleared });
  } catch (e) {
    return errorResponse(e);
  }
}
