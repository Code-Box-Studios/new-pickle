import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { errorResponse } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    assertPhoneOrigin(req);
    let response = NextResponse.redirect(new URL("/", resolveMagicLinkBase(req.nextUrl.origin)), { status: 303 });
    if (hasSupabaseConfig()) {
      const client = createSupabaseRequestClient(req);
      await client.supabase.auth.signOut({ scope: "local" });
      response = client.applyCookies(response);
    }
    // Also remove stale chunks when Supabase has already expired the session.
    for (const { name } of req.cookies.getAll()) {
      if (name === "rallypoint_session" || name.startsWith("pikol-auth")) response.cookies.set(name, "", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0 });
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return errorResponse(error); }
}
