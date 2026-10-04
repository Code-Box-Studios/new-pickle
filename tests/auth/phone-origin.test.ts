import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";

afterEach(() => vi.unstubAllEnvs());
function request(url: string, origin: string, host?: string) {
  return new NextRequest(url, { headers: { Origin: origin, ...(host ? { Host: host } : {}) } });
}

describe("sign-in request origin", () => {
  it("accepts the browser host when Next dev binds to 0.0.0.0", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertPhoneOrigin(request("http://0.0.0.0:3000/api/auth/mfa", "http://localhost:3000", "localhost:3000"))).not.toThrow();
  });
  it.each(["https://attacker.test", "http://localhost:4000", "https://localhost:3000"]) ("rejects cross-origin development request %s", origin => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertPhoneOrigin(request("http://0.0.0.0:3000/api/auth/mfa", origin, "localhost:3000"))).toThrow("Open Pikol directly");
  });
  it("keeps production bound to APP_URL, ignoring an alternate Host", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://pikol-ph.vercel.app");
    expect(() => assertPhoneOrigin(request("https://pikol-ph.vercel.app/api/auth/mfa", "https://attacker.test", "attacker.test"))).toThrow();
    expect(() => assertPhoneOrigin(request("https://internal.vercel.app/api/auth/mfa", "https://pikol-ph.vercel.app", "internal.vercel.app"))).not.toThrow();
  });
});
