import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetDb } from "../db";
import { POST as requestCode } from "@/app/api/auth/phone/request/route";
import { POST as verifyCode } from "@/app/api/auth/phone/verify/route";
import { getSessionFromRequest } from "@/lib/auth/session";

import { authPayload, phoneUser } from "../helpers/supabase";
vi.mock("server-only", () => ({}));
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (String(url).includes("/otp")) return new Response("{}");
    if (String(url).includes("/user")) return new Response(JSON.stringify(phoneUser()));
    return new Response(JSON.stringify(authPayload(phoneUser())));
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function request(path: string, body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(`http://localhost:3000/api/auth/phone/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
  });
}

describe("phone auth API", () => {
  it("rejects cross-site send and verification requests", async () => {
    expect((await requestCode(request("request", { phone: "09171234567" }, "https://other.test"))).status).toBe(403);
    expect((await verifyCode(request("verify", { challengeId: "x", code: "123456" }, "https://other.test"))).status).toBe(403);
  });

  it("limits requests across different numbers from the same untrusted client", async () => {
    for (let index = 0; index < 20; index++) {
      const response = await requestCode(request("request", { phone: `0917${String(index).padStart(7, "0")}` }));
      expect(response.status).toBe(200);
    }
    expect((await requestCode(request("request", { phone: "09179999999" }))).status).toBe(429);
  });

  it("sets a verified phone session, rejects replay, and keeps redirects local", async () => {
    const sent = await requestCode(request("request", { phone: "09171234567" }));
    expect(sent.status).toBe(200);
    const challenge = await sent.json();
    const body = { challengeId: challenge.id, code: "123456", next: "https://other.test" };
    const verified = await verifyCode(request("verify", body));
    expect(verified.status).toBe(200);
    expect((await verified.json()).next).toBe("/bookings");
    const tokens = verified.cookies.getAll();
    expect(tokens.some(cookie => cookie.name.startsWith("pikol-auth") && cookie.httpOnly)).toBe(true);
    const signedIn = new NextRequest("http://localhost:3000", { headers: { cookie: tokens.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") } });
    expect(await getSessionFromRequest(signedIn)).toMatchObject({ email: null, mobile: "+639171234567", role: "CUSTOMER" });
    expect((await verifyCode(request("verify", body))).status).toBe(400);
  });
});
