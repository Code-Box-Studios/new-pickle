import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authCookieOptions, supabaseConfig } from "./config";

/** Server-only auth: no privileged key is needed to request or verify OTPs. */
export function createSupabaseAuthClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function createSupabaseServerClient() {
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Server Components cannot mutate cookies; proxy.ts refreshes them.
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only render */ }
      },
    },
  });
}

/** Payload strategies receive Headers rather than a NextRequest. */
export function createSupabaseHeadersClient(headers: Headers) {
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => parseCookieHeader(headers.get("cookie") ?? "").map(({ name, value }) => ({ name, value: value ?? "" })),
      setAll() { /* the Next.js proxy owns session refresh cookies */ },
    },
  });
}
