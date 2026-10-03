import { AppError } from "@/lib/booking/errors";

export function hasSupabaseConfig() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new AppError("Sign-in is not configured yet. Please try again later.", 503, "auth_unavailable");
  return { url, key };
}

export const authCookieOptions = () => ({
  name: "pikol-auth", path: "/", httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
});
