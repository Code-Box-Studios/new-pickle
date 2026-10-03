import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, supabaseConfig } from "./config";

/** Buffer cookies so failed identity binding never signs the browser in. */
export function createSupabaseRequestClient(request: NextRequest) {
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) { values.forEach(cookie => pending.set(cookie.name, cookie)); },
    },
  });
  return {
    supabase,
    applyCookies(response: NextResponse) {
      pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    },
  };
}
