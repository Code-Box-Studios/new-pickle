import type { Role } from "@/generated/prisma";
import type { NextRequest } from "next/server";
import { cache } from "react";
import prisma from "@/lib/prisma";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseHeadersClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { isPreviewMode } from "@/lib/deployment";

export interface SessionUser {
  id: string;
  email: string | null;
  mobile?: string | null;
  role: Role;
}

async function verifiedSession(client: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<SessionUser | null> {
  if (isPreviewMode()) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
  return user?.isActive ? { id: user.id, email: user.email, mobile: user.verifiedMobile, role: user.role } : null;
}

// Share verified identity only within one server render. React does not retain
// this result across requests or memoize calls from API handlers.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (!hasSupabaseConfig()) return null;
  return verifiedSession(await createSupabaseServerClient());
});

export async function getSessionFromHeaders(headers: Headers): Promise<SessionUser | null> {
  if (!hasSupabaseConfig()) return null;
  return verifiedSession(createSupabaseHeadersClient(headers));
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  return getSessionFromHeaders(request.headers);
}
