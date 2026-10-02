import { NextRequest, NextResponse } from "next/server";
import { requestPhoneCode } from "@/lib/auth/phone-code";
import { errorResponse } from "@/lib/http";
import { ValidationError } from "@/lib/booking/errors";
import { phoneClientKey } from "@/lib/auth/phone-client";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";

export async function POST(req: NextRequest) {
  try {
    assertPhoneOrigin(req);
    const body = await req.json() as { phone?: unknown };
    if (typeof body.phone !== "string") throw new ValidationError("Enter your mobile number.");
    return NextResponse.json(await requestPhoneCode(body.phone, phoneClientKey(req.headers)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
