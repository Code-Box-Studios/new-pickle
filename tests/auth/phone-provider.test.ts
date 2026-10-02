import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { phoneProvider, startSmsVerification, checkSmsVerification } from "@/lib/auth/phone-provider";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC" + "a".repeat(32));
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-secret");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA" + "b".repeat(32));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("SMS verification delivery", () => {
  it("does not fall back to development codes when production delivery is unconfigured", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(() => phoneProvider()).toThrow();
  });

  it("sends a real Verify request and pins verification to its returned SID", async () => {
    const sid = "VE" + "c".repeat(32);
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ sid, status: "pending" }))).mockResolvedValueOnce(new Response(JSON.stringify({ status: "approved" })));
    vi.stubGlobal("fetch", fetch);
    expect(phoneProvider()).toBe("twilio");
    expect(await startSmsVerification("+639171234567")).toBe(sid);
    expect(await checkSmsVerification(sid, "123456")).toBe(true);
    expect(fetch.mock.calls[0][1].body.get("To")).toBe("+639171234567");
    expect(fetch.mock.calls[1][1].body.get("VerificationSid")).toBe(sid);
    expect(fetch.mock.calls[1][1].body.get("Code")).toBe("123456");
  });

  it("does not approve pending or expired provider responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" }))).mockResolvedValueOnce(new Response(null, { status: 404 })));
    expect(await checkSmsVerification("VE" + "c".repeat(32), "123456")).toBe(false);
    expect(await checkSmsVerification("VE" + "c".repeat(32), "123456")).toBe(false);
  });

  it("reports SMS provider failures instead of claiming a code was sent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(startSmsVerification("+639171234567")).rejects.toMatchObject({ httpStatus: 503 });
  });
});
