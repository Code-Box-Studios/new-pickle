import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { notificationService } from "@/lib/notifications/service";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json({ count: await notificationService.unreadCount(session.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
