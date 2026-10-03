import { NextRequest, NextResponse } from "next/server";
import { consumePhoneCode } from "@/lib/auth/phone-code";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { safeNextPath } from "@/lib/auth/redirect";
import { errorResponse } from "@/lib/http";
import { ValidationError } from "@/lib/booking/errors";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { assertFullAppEnabled } from "@/lib/deployment";

export async function POST(req: NextRequest) {
  try {
    assertPhoneOrigin(req);
    assertFullAppEnabled();
    const body = await req.json() as { challengeId?: unknown; code?: unknown; next?: unknown };
    if (typeof body.challengeId !== "string" || typeof body.code !== "string") throw new ValidationError("Enter the six-digit code.");
    const client = createSupabaseRequestClient(req);
    const user = await consumePhoneCode(body.challengeId, body.code, client.supabase);
    if (!user) throw new ValidationError("That code is invalid or expired. Try again or request a new code.");
    const roleHome = user.role === "ADMIN" ? "/admin" : user.role === "CUSTOMER" ? "/bookings" : "/owner";
    const response = NextResponse.json({ ok: true, next: safeNextPath(body.next) ?? roleHome }, { headers: { "Cache-Control": "no-store" } });
    return client.applyCookies(response);
  } catch (error) {
    return errorResponse(error);
  }
}
