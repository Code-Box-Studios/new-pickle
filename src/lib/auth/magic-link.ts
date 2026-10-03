import { AppError, ValidationError } from "@/lib/booking/errors";
import { createSupabaseAuthClient } from "@/lib/supabase/server";
import { throwAuthProviderError } from "./provider-error";
import { safeNextPath } from "./redirect";
import { assertFullAppEnabled } from "@/lib/deployment";

export function resolveMagicLinkBase(origin?: string): string {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.APP_URL) throw new AppError("Sign-in is not configured yet.", 503, "auth_unavailable");
    return new URL(process.env.APP_URL).origin;
  }
  return origin ?? process.env.APP_URL ?? "http://localhost:3000";
}

export async function requestMagicLink(emailRaw: string, opts?: { origin?: string; next?: unknown }): Promise<void> {
  assertFullAppEnabled();
  const email = emailRaw.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("Enter a valid email address");
  const redirect = new URL("/auth/verify", resolveMagicLinkBase(opts?.origin));
  const next = safeNextPath(opts?.next);
  redirect.searchParams.set("next", next ?? "");
  const { error } = await createSupabaseAuthClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true } });
  if (error) throwAuthProviderError(error, "email");
}
