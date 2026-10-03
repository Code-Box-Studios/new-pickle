import type { User } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { ConflictError } from "@/lib/booking/errors";
import type { SessionUser } from "./session";

/** Call only with a User returned by Supabase verification, never browser input. */
export async function resolveSupabaseUser(identity: User): Promise<SessionUser | null> {
  if (!identity.id || identity.is_anonymous) return null;
  const email = identity.email_confirmed_at && identity.email ? identity.email.trim().toLowerCase() : null;
  const phone = identity.phone_confirmed_at && identity.phone ? `+${identity.phone.replace(/^\+/, "")}` : null;
  if (!email && !phone) return null;

  return prisma.$transaction(async tx => {
    const locks = [`auth:${identity.id}`, ...(email ? [`email:${email}`] : []), ...(phone ? [`mobile:${phone}`] : [])].sort();
    for (const lock of locks) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lock}))`;
    const matches = await tx.user.findMany({ where: { OR: [
      { supabaseId: identity.id }, ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []), ...(phone ? [{ verifiedMobile: phone }] : []),
    ] } });
    if (matches.length > 1 || (matches[0]?.supabaseId && matches[0].supabaseId !== identity.id)) {
      throw new ConflictError("These sign-in details belong to different accounts. Please contact support.");
    }
    const existing = matches[0];
    if (existing && !existing.isActive) return null;
    const data = { supabaseId: identity.id, ...(email ? { email } : {}), ...(phone ? { verifiedMobile: phone } : {}) };
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data })
      : await tx.user.create({ data: { ...data, mobile: phone, role: "CUSTOMER" } });
    return { id: user.id, email: user.email, mobile: user.verifiedMobile, role: user.role };
  });
}
