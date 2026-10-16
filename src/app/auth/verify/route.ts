import { NextRequest, NextResponse } from "next/server";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { resolveSupabaseUser } from "@/lib/auth/supabase-user";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { isPreviewMode } from "@/lib/deployment";
import { ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { privateAuthResponse } from "@/lib/auth/password";

export async function GET(req: NextRequest) {
  // Next dev exposes its bind address in nextUrl. Keep redirects on the
  // browser's host so the session cookie reaches the next page. Production
  // still uses APP_URL exclusively via resolveMagicLinkBase.
  const browserOrigin = req.headers.get("host") ? `${req.nextUrl.protocol}//${req.headers.get("host")}` : req.nextUrl.origin;
  const base = resolveMagicLinkBase(browserOrigin);
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const code = req.nextUrl.searchParams.get("code");
  const flowId = req.nextUrl.searchParams.get("sb_flow_id");
  const type = req.nextUrl.searchParams.get("type");
  const failure = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, base), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  if (isPreviewMode()) return failure("unavailable");
  if (!tokenHash && !code) {
    // Default implicit email links carry credentials in a fragment only the browser can read.
    const login = new URL("/login", base);
    const next = safeNextPath(req.nextUrl.searchParams.get("next"));
    if (next) login.searchParams.set("next", next);
    return privateAuthResponse(NextResponse.redirect(login));
  }
  if (tokenHash && type !== "email") return failure("missing");
  try {
    const client = createSupabaseRequestClient(req);
    const { data, error } = code
      ? await client.supabase.auth.exchangeCodeForSession(code, flowId === null ? undefined : { flowId })
      : await client.supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "email" });
    if (error || !data.user || !data.session) return failure("invalid");
    const user = await resolveSupabaseUser(data.user);
    if (!user) return failure("invalid");
    const home = user.role === "ADMIN" ? "/admin" : user.role === "CUSTOMER" ? "/bookings" : "/owner";
    const destination = safeNextPath(req.nextUrl.searchParams.get("next")) ?? home;
    const next = requiresOwnerMfa(user.role) ? ownerVerificationPath(destination) : destination;
    const response = client.applyCookies(NextResponse.redirect(new URL(next, base)));
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure("invalid");
  }
}
