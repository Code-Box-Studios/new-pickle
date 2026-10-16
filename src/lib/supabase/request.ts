import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, supabaseConfig } from "./config";

/** Buffer cookies so failed identity binding never signs the browser in. */
export function createSupabaseRequestClient(request: NextRequest) {
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const { url, key } = supabaseConfig();
  const cookieOptions = authCookieOptions();
  const supabase = createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) { values.forEach(cookie => pending.set(cookie.name, cookie)); },
    },
  });
  return {
    supabase,
    applyCookies(response: NextResponse, { onlyVerifierCookies = false }: { onlyVerifierCookies?: boolean } = {}) {
      pending.forEach(({ name, value, options }) => {
        const key = name.replace(/\.\d+$/, "");
        const verifier = key === `${cookieOptions.name}-code-verifier` || key === `${cookieOptions.name}-flows-code-verifier` ||
          (key.startsWith(`${cookieOptions.name}-flow-`) && key.endsWith("-code-verifier"));
        if (!onlyVerifierCookies || verifier) response.cookies.set(name, value, options);
      });
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    },
  };
}
