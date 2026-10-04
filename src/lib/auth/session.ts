import type { Role } from "@/generated/prisma";
import type { NextRequest } from "next/server";
import { cache } from "react";
import prisma from "@/lib/prisma";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseHeadersClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/deployment";
import { requiresOwnerMfa } from "./owner-security";

export interface SessionUser {
  id: string;
  email: string | null;
  mobile?: string | null;
  role: Role;
}

export interface SignInSession extends SessionUser {
  mfaVerified: boolean;
}

async function verifiedSession(client: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<SignInSession | null> {
  if (isPreviewMode()) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
  if (!user?.isActive) return null;
  let mfaVerified = false;
  if (requiresOwnerMfa(user.role)) {
    try {
      // getUser() above verifies this client's token with Supabase. Read AAL
      // from that same token, and factor status from the fresh verified user.
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      mfaVerified = !assurance.error && assurance.data?.currentLevel === "aal2"
        && assurance.data.currentAuthenticationMethods.some(method => (typeof method === "string" ? method : method.method) === "totp")
        && !!data.user.factors?.some(factor => factor.factor_type === "totp" && factor.status === "verified");
    } catch { /* A provider failure must never grant workspace access. */ }
  }
  return { id: user.id, email: user.email, mobile: user.verifiedMobile, role: user.role, mfaVerified };
}

// First-factor identity is ONLY for sign-in routing and the MFA endpoint.
// All application data and mutation callers must continue using getSession().
export const getSignInSession = cache(async (): Promise<SignInSession | null> => {
  if (!hasSupabaseConfig()) return null;
  return verifiedSession(await createSupabaseServerClient());
});

function protectedSession(session: SignInSession | null): SessionUser | null {
  return session && (!requiresOwnerMfa(session.role) || session.mfaVerified) ? session : null;
}

// Per-render caching never shares permissions or MFA state across requests.
export const getSession = cache(async (): Promise<SessionUser | null> => protectedSession(await getSignInSession()));

export async function getSessionFromHeaders(headers: Headers): Promise<SessionUser | null> {
  if (!hasSupabaseConfig()) return null;
  return protectedSession(await verifiedSession(createSupabaseHeadersClient(headers)));
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  return getSessionFromHeaders(request.headers);
}

/** Restricted to the MFA endpoint; does not authorize application access. */
export async function getSignInSessionFromRequest(request: NextRequest): Promise<SignInSession | null> {
  if (!hasSupabaseConfig()) return null;
  return verifiedSession(createSupabaseHeadersClient(request.headers));
}
