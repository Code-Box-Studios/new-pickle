import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { AppError, ValidationError } from "@/lib/booking/errors";
import { createSupabaseAuthClient } from "@/lib/supabase/server";
import { resolveSupabaseUser } from "./supabase-user";
import { throwAuthProviderError } from "./provider-error";
import type { SessionUser } from "./session";

export function normalizePhone(raw: string): string {
  if (raw.length > 40 || !/^[+\d\s()-]+$/.test(raw)) throw new ValidationError("Enter a valid Philippine mobile number.");
  let phone = raw.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(phone)) phone = `+63${phone.slice(1)}`;
  else if (/^9\d{9}$/.test(phone)) phone = `+63${phone}`;
  else if (/^639\d{9}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+639\d{9}$/.test(phone)) throw new ValidationError("Enter a valid Philippine mobile number.");
  return phone;
}


export async function requestPhoneCode(raw: string, clientKey?: string) {
  const phone = normalizePhone(raw);
  const supabase = createSupabaseAuthClient();
  const id = randomUUID();
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60_000);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone:${phone}`}))`;
    if (clientKey) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone-client:${clientKey}`}))`;
    const recent = await tx.phoneChallenge.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
    if (recent && now.getTime() - recent.createdAt.getTime() < 60_000) throw new AppError("Wait 60 seconds before requesting another code.", 429, "rate_limited");
    const count = await tx.phoneChallenge.count({ where: { phone, createdAt: { gte: since } } });
    const clientCount = clientKey ? await tx.phoneChallenge.count({ where: { clientKey, createdAt: { gte: since } } }) : 0;
    if (count >= 5 || clientCount >= 20) throw new AppError("Too many codes requested. Please try again later.", 429, "rate_limited");
    await tx.phoneChallenge.updateMany({ where: { phone, usedAt: null }, data: { usedAt: now } });
    await tx.phoneChallenge.create({ data: { id, phone, clientKey, provider: "supabase", expiresAt: new Date(now.getTime() + 10 * 60_000) } });
  });
  try {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    if (error) throwAuthProviderError(error, "phone");
  } catch (error) {
    await prisma.phoneChallenge.update({ where: { id }, data: { usedAt: new Date() } });
    throw error;
  }
  return { id, phone, retryAfter: 60 };
}

export async function consumePhoneCode(id: string, code: string, supabase?: SupabaseClient): Promise<SessionUser | null> {
  if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const challenge = await prisma.phoneChallenge.findUnique({ where: { id } });
  if (!challenge || challenge.provider !== "supabase" || challenge.usedAt || challenge.expiresAt <= new Date()) return null;
  const attempt = await prisma.phoneChallenge.updateMany({ where: { id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { attempts: { increment: 1 } } });
  if (!attempt.count) return null;
  const { data, error } = await (supabase ?? createSupabaseAuthClient()).auth.verifyOtp({ phone: challenge.phone, token: code, type: "sms" });
  if (error) {
    if (error.status === 429 || (error.status ?? 0) >= 500) throwAuthProviderError(error, "phone");
    return null;
  }
  if (!data.user || !data.session || !data.user.phone_confirmed_at || `+${data.user.phone?.replace(/^\+/, "")}` !== challenge.phone) return null;
  const consumed = await prisma.phoneChallenge.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (!consumed.count) return null;
  return resolveSupabaseUser(data.user);
}
