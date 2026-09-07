import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { notificationService } from "@/lib/notifications/service";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireUser();
    const [items, unread] = await Promise.all([
      notificationService.listForUser(session.id),
      notificationService.unreadCount(session.id),
    ]);
    return NextResponse.json({ items, unread });
  } catch (e) {
    return errorResponse(e);
  }
}
