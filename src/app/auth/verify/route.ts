import { NextRequest, NextResponse } from "next/server";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { resolveSupabaseUser } from "@/lib/auth/supabase-user";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { isPreviewMode } from "@/lib/deployment";

export async function GET(req: NextRequest) {
  const base = resolveMagicLinkBase(req.nextUrl.origin);
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  const failure = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, base), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  if (isPreviewMode()) return failure("unavailable");
  if (!tokenHash || type !== "email") return failure("missing");
  try {
    const client = createSupabaseRequestClient(req);
    const { data, error } = await client.supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error || !data.user || !data.session) return failure("invalid");
    const user = await resolveSupabaseUser(data.user);
    if (!user) return failure("invalid");
    const home = user.role === "ADMIN" ? "/admin" : user.role === "CUSTOMER" ? "/bookings" : "/owner";
    const next = safeNextPath(req.nextUrl.searchParams.get("next")) ?? home;
    const response = client.applyCookies(NextResponse.redirect(new URL(next, base)));
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure("invalid");
  }
}
