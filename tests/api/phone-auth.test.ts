import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resetDb } from "../db";
import { POST as requestCode } from "@/app/api/auth/phone/request/route";
import { POST as verifyCode } from "@/app/api/auth/phone/verify/route";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

beforeEach(resetDb);

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

  it("sets a verified phone session, rejects replay, and keeps redirects local", async () => {
    const sent = await requestCode(request("request", { phone: "09171234567" }));
    expect(sent.status).toBe(200);
    const challenge = await sent.json();
    const body = { challengeId: challenge.id, code: challenge.devCode, next: "https://other.test" };
    const verified = await verifyCode(request("verify", body));
    expect(verified.status).toBe(200);
    expect((await verified.json()).next).toBe("/bookings");
    const token = verified.cookies.get(SESSION_COOKIE)!;
    expect(token.httpOnly).toBe(true);
    expect(await verifySession(token.value)).toMatchObject({ email: null, mobile: "+639171234567", role: "CUSTOMER" });
    expect((await verifyCode(request("verify", body))).status).toBe(400);
  });
});
