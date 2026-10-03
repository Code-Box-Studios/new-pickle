import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Untrusted forwarding headers share a budget; only a proven proxy may supply an IP. */
export function phoneClientKey(headers: Headers): string {
  const expected = process.env.PHONE_AUTH_PROXY_SECRET;
  const provided = headers.get("x-rallypoint-proxy-secret");
  const address = headers.get("x-real-ip");
  let identity = "shared-sms-client";
  if (expected && provided && address && isIP(address)) {
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(provided);
    if (expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)) {
      identity = address;
    }
  }
  return createHash("sha256").update(identity).digest("hex");
}
