import type { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/booking/errors";

/** Prevent another website from sending codes or signing a browser into an account. */
export function assertPhoneOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = process.env.NODE_ENV === "production" && process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : request.nextUrl.origin;
  if (origin && origin !== expected) throw new ForbiddenError("Open Pikol directly to sign in.");
}
