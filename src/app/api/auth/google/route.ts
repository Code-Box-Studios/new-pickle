import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/booking/errors";
import { passwordDestination, passwordFailure, passwordRequest, privateAuthResponse } from "@/lib/auth/password";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { supabaseConfig } from "@/lib/supabase/config";

export async function POST(req: NextRequest) {
  try {
    const body = await passwordRequest(req);
    // Audience chooses a landing page only. Roles come from the verified account.
    const destination = body.next == null && body.audience !== "owner"
      ? undefined
      : passwordDestination(body.next ?? "/owner");
    const callback = new URL("/auth/verify", resolveMagicLinkBase(req.headers.get("origin") ?? undefined));
    if (destination) callback.searchParams.set("next", destination);
    callback.searchParams.set("provider", "google");
    const client = createSupabaseRequestClient(req);
    const { data, error } = await client.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) throw new AppError("Google sign-in is unavailable. Please try again.", 503, "auth_unavailable");
    const authorize = new URL(data.url);
    if (authorize.origin !== new URL(supabaseConfig().url).origin || authorize.pathname !== "/auth/v1/authorize" || authorize.searchParams.get("provider") !== "google") {
      throw new AppError("Google sign-in is unavailable. Please try again.", 503, "auth_unavailable");
    }
    return privateAuthResponse(client.applyCookies(
      NextResponse.json({ ok: true, url: authorize.toString() }),
      { onlyVerifierCookies: true },
    ));
  } catch (error) {
    return passwordFailure(error);
  }
}
