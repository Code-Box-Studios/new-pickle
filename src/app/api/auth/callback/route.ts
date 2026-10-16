import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { resolveSupabaseUser } from "@/lib/auth/supabase-user";
import { passwordDestination, passwordFailure, passwordRequest, privateAuthResponse } from "@/lib/auth/password";
import { ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { safeNextPath } from "@/lib/auth/redirect";
import { UnauthorizedError, ValidationError } from "@/lib/booking/errors";

/** Finish default Supabase email links with the same HttpOnly cookies as password sign-in. */
export async function POST(req: NextRequest) {
  try {
    const body = await passwordRequest(req);
    if (typeof body.access_token !== "string" || !body.access_token || body.access_token.length > 16384 ||
        typeof body.refresh_token !== "string" || !body.refresh_token || body.refresh_token.length > 1024) {
      throw new ValidationError("Open a complete sign-in link from your email.");
    }
    const client = createSupabaseRequestClient(req);
    // Supabase verifies the supplied access token, or refreshes an expired session.
    // Browser-supplied user details and role claims are never account authority.
    const { data, error } = await client.supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    if (error || !data.user || !data.session) throw new UnauthorizedError("That sign-in link is invalid or expired.");
    const user = await resolveSupabaseUser(data.user);
    if (!user) throw new UnauthorizedError("Unable to sign in. Verify your email or contact support.");
    const requested = safeNextPath(body.next);
    const destination = requested && new URL(requested, "https://pikol.invalid").pathname === "/reset-password"
      ? requested : passwordDestination(requested, user.role);
    const next = requiresOwnerMfa(user.role) ? ownerVerificationPath(destination) : destination;
    return privateAuthResponse(client.applyCookies(NextResponse.json({ ok: true, next })));
  } catch (error) {
    return passwordFailure(error);
  }
}
