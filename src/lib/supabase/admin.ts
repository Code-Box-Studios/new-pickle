import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/booking/errors";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError("Uploads are not configured yet. Please try again later.", 503, "storage_unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
