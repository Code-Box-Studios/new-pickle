import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { passwordEmail, passwordFailure, passwordRequest, privateAuthResponse, throwPasswordProviderError } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";

export async function POST(req: NextRequest) {
  try {
    const body = await passwordRequest(req);
    const email = passwordEmail(body.email);
    const reset = new URL("/reset-password", "https://pikol.invalid");
    const next = safeNextPath(body.next);
    if (next) reset.searchParams.set("next", next);
    const redirect = new URL("/auth/verify", resolveMagicLinkBase(req.headers.get("origin")!));
    redirect.searchParams.set("next", reset.pathname + reset.search);
    // Both custom token-hash and default PKCE email templates require verification.
    const client = createSupabaseRequestClient(req);
    const { error } = await client.supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirect.toString() } });
    // Per-email cooldowns must have the same response as unknown accounts.
    // Global request throttling remains visible and enforced by Supabase.
    if (error && !["otp_disabled", "user_not_found", "over_email_send_rate_limit"].includes(error.code || "")) throwPasswordProviderError(error);
    return privateAuthResponse(client.applyCookies(NextResponse.json({ ok: true }), { onlyVerifierCookies: true }));
  } catch (error) { return passwordFailure(error); }
}
