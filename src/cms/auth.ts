import { getSessionFromHeaders, type SessionUser } from "@/lib/auth/session";

/** Supabase verifies the identity; Pikol's database supplies the live role. */
export async function resolveCmsAdmin(headers: Headers): Promise<(SessionUser & { email: string }) | null> {
  const session = await getSessionFromHeaders(headers);
  return session?.role === "ADMIN" && session.email ? { ...session, email: session.email } : null;
}
