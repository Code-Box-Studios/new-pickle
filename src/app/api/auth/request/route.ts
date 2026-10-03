import { NextRequest, NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { ValidationError } from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    assertPhoneOrigin(req);
    const body = (await req.json()) as { email?: unknown; next?: unknown };
    if (typeof body.email !== "string") throw new ValidationError("Enter a valid email address");
    await requestMagicLink(body.email, { origin: req.nextUrl.origin, next: body.next });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
