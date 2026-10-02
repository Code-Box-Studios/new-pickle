import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { AppError, ValidationError } from "@/lib/booking/errors";
import { phoneProvider, startSmsVerification, checkSmsVerification } from "./phone-provider";
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

function codeHash(id: string, code: string) {
  return createHmac("sha256", process.env.JWT_SECRET ?? "dev-secret-change-in-production")
    .update(`${id}:${code}`).digest("hex");
}

export async function requestPhoneCode(raw: string, clientKey?: string) {
  const phone = normalizePhone(raw);
  const provider = phoneProvider();
  const id = randomUUID();
  const code = provider === "development" ? String(randomInt(100000, 1000000)) : null;
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60_000);
  await prisma.$transaction(async (tx) => {
    // Serialize send limits across processes and concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone:${phone}`}))`;
    if (clientKey) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone-client:${clientKey}`}))`;
    const recent = await tx.phoneChallenge.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
    if (recent && now.getTime() - recent.createdAt.getTime() < 60_000) throw new AppError("Wait 60 seconds before requesting another code.", 429, "rate_limited");
    const count = await tx.phoneChallenge.count({ where: { phone, createdAt: { gte: since } } });
    const clientCount = clientKey ? await tx.phoneChallenge.count({ where: { clientKey, createdAt: { gte: since } } }) : 0;
    if (count >= 5 || clientCount >= 20) throw new AppError("Too many codes requested. Please try again later.", 429, "rate_limited");
    await tx.phoneChallenge.updateMany({ where: { phone, usedAt: null }, data: { usedAt: now } });
    await tx.phoneChallenge.create({ data: { id, phone, clientKey, provider, codeHash: code ? codeHash(id, code) : null, expiresAt: new Date(now.getTime() + 10 * 60_000) } });
  });
  try {
    if (provider === "twilio") {
      const providerSid = await startSmsVerification(phone);
      await prisma.phoneChallenge.update({ where: { id }, data: { providerSid } });
    }
  } catch (error) {
    await prisma.phoneChallenge.update({ where: { id }, data: { usedAt: new Date() } });
    throw error;
  }
  return { id, phone, retryAfter: 60, ...(code ? { devCode: code } : {}) };
}

export async function consumePhoneCode(id: string, code: string): Promise<SessionUser | null> {
  if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const challenge = await prisma.phoneChallenge.findUnique({ where: { id } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) return null;
  if (challenge.provider === "development" && process.env.NODE_ENV === "production") return null;
  const attempt = await prisma.phoneChallenge.updateMany({
    where: { id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (!attempt.count) return null;
  const approved = challenge.provider === "twilio"
    ? !!challenge.providerSid && await checkSmsVerification(challenge.providerSid, code)
    : !!challenge.codeHash && timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(codeHash(id, code), "hex"));
  if (!approved) return null;
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.phoneChallenge.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (!consumed.count) return null;
    const user = await tx.user.upsert({ where: { verifiedMobile: challenge.phone }, update: {}, create: { verifiedMobile: challenge.phone, mobile: challenge.phone, role: "CUSTOMER" } });
    return user.isActive ? { id: user.id, email: user.email, mobile: user.verifiedMobile, role: user.role } : null;
  });
}
