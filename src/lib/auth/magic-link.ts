import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { emailSender } from "@/lib/email";
import { forgetMagicLink } from "@/lib/email/dev-sender";
import { ValidationError } from "@/lib/booking/errors";
import type { SessionUser } from "./session";

const TTL_MINUTES = 15;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a single-use, short-TTL token (stored hashed) and email the link. */
export async function requestMagicLink(emailRaw: string): Promise<void> {
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

  const base = process.env.APP_URL ?? "http://localhost:3000";
  await emailSender.sendMagicLink(email, `${base}/auth/verify?token=${raw}`);
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
  forgetMagicLink(rec.user.email);

  return { id: rec.user.id, email: rec.user.email, role: rec.user.role };
}
