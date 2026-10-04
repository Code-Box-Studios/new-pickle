import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSignInSessionFromRequest } from "@/lib/auth/session";
import { ownerDestination, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { AppError, ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";
import { assertFullAppEnabled } from "@/lib/deployment";

const FACTOR_NAME = "Pikol venue workspace";
const unavailable = () => new AppError("Authenticator verification is unavailable. Please try again.", 503, "mfa_unavailable");

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

async function ownerIdentity(req: NextRequest) {
  assertFullAppEnabled();
  const session = await getSignInSessionFromRequest(req);
  if (!session) throw new UnauthorizedError();
  if (!requiresOwnerMfa(session.role)) throw new ForbiddenError("Authenticator setup is for venue workspace accounts.");
  return session;
}

export async function GET(req: NextRequest) {
  try {
    await ownerIdentity(req);
    const client = createSupabaseRequestClient(req);
    const result = await client.supabase.auth.mfa.listFactors();
    if (result.error) throw unavailable();
    const factors = result.data.totp.map(factor => ({ id: factor.id, name: factor.friendly_name || "Authenticator" }));
    return privateResponse(client.applyCookies(NextResponse.json({ factors })));
  } catch (error) { return privateResponse(errorResponse(error)); }
}

export async function POST(req: NextRequest) {
  try {
    // JSON + an explicit same-origin request protects factor setup and session upgrades.
    if (!req.headers.get("origin")) throw new ForbiddenError("Open Pikol directly to verify your account.");
    assertPhoneOrigin(req);
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ValidationError();
    const session = await ownerIdentity(req);
    const body = await req.json().catch(() => null) as { action?: unknown; factorId?: unknown; code?: unknown; next?: unknown } | null;
    if (!body || !["enroll", "verify"].includes(String(body.action))) throw new ValidationError();
    const client = createSupabaseRequestClient(req);
    const factors = await client.supabase.auth.mfa.listFactors();
    if (factors.error) throw unavailable();

    if (body.action === "enroll") {
      if (factors.data.totp.length) throw new ConflictError("An authenticator is already set up. Enter its code to continue.");
      // Never delete based on a status snapshot: another tab could verify that
      // factor meanwhile. Supabase removes unverified factors on verification.
      const enrolled = await client.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${FACTOR_NAME} (${randomUUID().slice(0, 8)})`, issuer: "Pikol" });
      if (enrolled.error) throw unavailable();
      return privateResponse(client.applyCookies(NextResponse.json({ id: enrolled.data.id, qrCode: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret })));
    }

    if (typeof body.factorId !== "string" || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) throw new ValidationError("Enter the six-digit code from your authenticator.");
    const factor = factors.data.all.find(factor => factor.id === body.factorId && factor.factor_type === "totp");
    if (!factor) throw new ValidationError("That authenticator is unavailable. Reload this page and try again.");
    // If setup was started in another tab, it cannot replace an existing factor.
    if (factor.status === "unverified" && factors.data.totp.length) throw new ConflictError("Use your existing authenticator to continue.");
    const verified = await client.supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: body.code });
    if (verified.error) {
      if (verified.error.status === 429) throw new AppError("Too many attempts. Wait a moment before trying again.", 429, "rate_limited");
      if (!verified.error.status || verified.error.status >= 500) throw unavailable();
      throw new ValidationError("That code is incorrect or expired. Try the latest code from your authenticator.");
    }
    if (!verified.data?.access_token || !verified.data.user) throw unavailable();
    return privateResponse(client.applyCookies(NextResponse.json({ ok: true, next: ownerDestination(body.next, session.role) })));
  } catch (error) { return privateResponse(errorResponse(error)); }
}
