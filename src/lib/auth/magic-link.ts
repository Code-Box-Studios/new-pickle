import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { emailSender } from "@/lib/email";
import { forgetMagicLink } from "@/lib/email/dev-sender";
import { ValidationError } from "@/lib/booking/errors";
import type { SessionUser } from "./session";
import { safeNextPath } from "./redirect";

const TTL_MINUTES = 15;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Base URL for magic links. Prod always uses APP_URL (an attacker-supplied Host
 * can never redirect a prod link). In dev/test we honor the request origin so a
 * link requested from a phone on the LAN opens on that phone.
 */
export function resolveMagicLinkBase(origin?: string): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.APP_URL ?? "http://localhost:3000";
  }
  return origin ?? process.env.APP_URL ?? "http://localhost:3000";
}

/** Create a single-use, short-TTL token (stored hashed) and email the link. */
export async function requestMagicLink(
  emailRaw: string,
  opts?: { origin?: string; next?: unknown },
): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError("Enter a valid email address");

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "CUSTOMER" },
  });

  const raw = randomBytes(32).toString("hex");
  await prisma.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });

  const base = resolveMagicLinkBase(opts?.origin);
  const link = new URL("/auth/verify", base);
  link.searchParams.set("token", raw);
  const next = safeNextPath(opts?.next);
  if (next) link.searchParams.set("next", next);
  await emailSender.sendMagicLink(email, link.toString());
}

/** Validate + burn a token, returning the session it authorizes (or null). */
export async function consumeMagicToken(raw: string): Promise<SessionUser | null> {
  if (!raw) return null;
  const rec = await prisma.magicLinkToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return null;

  // Burn it (single-use). If two requests race, only one flips usedAt from null.
  const burned = await prisma.magicLinkToken.updateMany({
    where: { id: rec.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (burned.count === 0) return null;

  // Dev-only: the link has now been used, so remove it from the login banner.
  if (rec.user.email) forgetMagicLink(rec.user.email);

  return { id: rec.user.id, email: rec.user.email, role: rec.user.role };
}
