import { afterEach, describe, expect, it, vi } from "vitest";
import { phoneClientKey } from "@/lib/auth/phone-client";

afterEach(() => vi.unstubAllEnvs());

describe("trusted SMS client address", () => {
  it("rejects forged or missing proxy proof in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHONE_AUTH_PROXY_SECRET", "a-private-proxy-secret");
    for (const headers of [new Headers(), new Headers({ "x-real-ip": "1.2.3.4" }), new Headers({ "x-real-ip": "1.2.3.4", "x-rallypoint-proxy-secret": "forged" })]) {
      expect(() => phoneClientKey(headers)).toThrow();
    }
  });

  it("requires a valid proxy-supplied address and ignores forwarding chains", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHONE_AUTH_PROXY_SECRET", "a-private-proxy-secret");
    const base = { "x-rallypoint-proxy-secret": "a-private-proxy-secret", "x-real-ip": "1.2.3.4" };
    expect(phoneClientKey(new Headers(base))).toBe(phoneClientKey(new Headers({ ...base, "x-forwarded-for": "99.99.99.99" })));
    expect(() => phoneClientKey(new Headers({ ...base, "x-real-ip": "invalid" }))).toThrow();
  });

  it("does not let supplied headers create new development buckets", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(phoneClientKey(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe(phoneClientKey(new Headers({ "x-real-ip": "5.6.7.8" })));
  });
});
