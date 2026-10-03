import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, hasSupabaseConfig, supabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseConfig()) return response;
  const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach(cookie => response.cookies.set(cookie));
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
      },
    },
  });
  // Unlike getSession(), getUser() verifies with Supabase and checks revocation.
  await supabase.auth.getUser();
  return response;
}
