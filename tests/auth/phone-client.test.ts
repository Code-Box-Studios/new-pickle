import { afterEach, describe, expect, it, vi } from "vitest";
import { phoneClientKey } from "@/lib/auth/phone-client";

afterEach(() => vi.unstubAllEnvs());

describe("SMS request identity", () => {
  it("does not let forged forwarding headers change the shared budget", () => {
    vi.stubEnv("PHONE_AUTH_PROXY_SECRET", "private-proxy-proof");
    const anonymous = phoneClientKey(new Headers());
    expect(phoneClientKey(new Headers({ "x-real-ip": "203.0.113.1", "x-forwarded-for": "203.0.113.1" }))).toBe(anonymous);
    expect(phoneClientKey(new Headers({ "x-real-ip": "203.0.113.2", "x-rallypoint-proxy-secret": "wrong" }))).toBe(anonymous);
    expect(phoneClientKey(new Headers({ "x-real-ip": "not-an-ip", "x-rallypoint-proxy-secret": "private-proxy-proof" }))).toBe(anonymous);
  });

  it("gives proven proxy addresses separate budgets without storing the raw IP", () => {
    vi.stubEnv("PHONE_AUTH_PROXY_SECRET", "private-proxy-proof");
    const key = (address: string) => phoneClientKey(new Headers({ "x-real-ip": address, "x-rallypoint-proxy-secret": "private-proxy-proof" }));
    expect(key("203.0.113.1")).toMatch(/^[a-f0-9]{64}$/);
    expect(key("203.0.113.1")).not.toBe(key("203.0.113.2"));
    expect(key("203.0.113.1")).not.toBe(phoneClientKey(new Headers()));
  });
});
