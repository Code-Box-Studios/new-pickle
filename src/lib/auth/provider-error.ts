import type { AuthError } from "@supabase/supabase-js";
import { AppError } from "@/lib/booking/errors";

export function throwAuthProviderError(error: AuthError, method: "email" | "phone"): never {
  if (error.status === 429) throw new AppError("Too many requests. Please wait a minute and try again.", 429, "rate_limited");
  throw new AppError(method === "phone" ? "Phone sign-in is temporarily unavailable. Please use email." : "We couldn't send your sign-in email. Please try again later.", 503, "auth_unavailable");
}
