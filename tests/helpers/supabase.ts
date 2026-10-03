import type { User } from "@supabase/supabase-js";

export function supabaseUser(fields: Partial<User> = {}): User {
  return { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-10-03T00:00:00Z", email: "player@example.com", email_confirmed_at: "2026-10-03T00:00:00Z", ...fields };
}
export function authPayload(user: User) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600, role: "authenticated" })}.test-signature`,
    token_type: "bearer", expires_in: 3600, refresh_token: "provider-refresh-token", user,
  };
}
export function phoneUser(phone = "+639171234567") {
  return supabaseUser({ email: undefined, email_confirmed_at: undefined, phone: phone.replace(/^\+/, ""), phone_confirmed_at: "2026-10-03T00:00:00Z" });
}
