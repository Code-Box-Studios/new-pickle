import type { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/booking/errors";

/** Prevent another website from sending codes or signing a browser into an account. */
export function assertPhoneOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const browserUrl = request.nextUrl.clone();
  // Next dev may use its 0.0.0.0 bind address in nextUrl. The browser's Host
  // is the request authority; never use forwarded host headers for this check.
  if (process.env.NODE_ENV !== "production" && request.headers.get("host")) {
    browserUrl.host = request.headers.get("host")!;
  }
  const expected = process.env.NODE_ENV === "production" && process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : browserUrl.origin;
  if (origin && origin !== expected) throw new ForbiddenError("Open Pikol directly to sign in.");
}
