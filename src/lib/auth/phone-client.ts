import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { AppError } from "@/lib/booking/errors";

/** Only a proxy with shared proof may supply an SMS rate-limit identity. */
export function phoneClientKey(headers: Headers): string {
  if (process.env.NODE_ENV !== "production") return createHash("sha256").update("development").digest("hex");
  const expected = process.env.PHONE_AUTH_PROXY_SECRET;
  const provided = headers.get("x-rallypoint-proxy-secret");
  const address = headers.get("x-real-ip");
  if (!expected || !provided || !address || !isIP(address)) {
    throw new AppError("Phone sign-in is temporarily unavailable. Please use email.", 503, "phone_unavailable");
  }
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(provided);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new AppError("Phone sign-in is temporarily unavailable. Please use email.", 503, "phone_unavailable");
  }
  return createHash("sha256").update(address).digest("hex");
}
