import "server-only";
import type { Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { lockBooking } from "@/lib/booking/lock";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/booking/errors";
export type Tx = Prisma.TransactionClient;
export const bookingInclude = { venue: true, court: true, participants: true, playerInvitations: true } satisfies Prisma.BookingInclude;
export type PlayerBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export async function activePlayer(userId: string, tx: Tx = prisma) {
  const u = await tx.user.findUnique({ where: { id: userId }, include: { playerProfile: true } });
  if (!u?.isActive) throw new ForbiddenError("This player account is unavailable.");
  return u;
}
export function assertHolder(b: PlayerBooking, userId: string) {
  if (b.userId !== userId) throw new ForbiddenError("Only this booking's current holder can manage its roster.");
}
export function assertRosterAccess(b: PlayerBooking, userId: string) {
  if (b.userId !== userId && !b.participants.some(p => p.userId === userId && p.status === "ACTIVE")) throw new ForbiddenError("You don't have permission to access this private session.");
}
export async function withPlayerBooking<T>(userId: string, bookingId: string, fn: (tx: Tx, b: PlayerBooking) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await lockBooking(tx, bookingId);
    await activePlayer(userId, tx);
    const b = await tx.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
    if (!b) throw new NotFoundError("Play session not found");
    return fn(tx, b);
  });
}
export async function limitPlayerWrites(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`player-writes:${userId}`}))`;
  if (await tx.playerAudit.count({ where: { actorId: userId, createdAt: { gte: new Date(Date.now() - 60000) } } }) >= 60) throw new AppError("Too many changes. Wait a minute before continuing.", 429, "rate_limited");
}
export async function audit(tx: Tx, actorId: string, bookingId: string | null, action: string, details?: Prisma.InputJsonObject) {
  await tx.playerAudit.create({ data: { actorId, bookingId, action, ...(details ? { details } : {}) } });
}
export async function defaultNickname(userId: string, tx: Tx) {
  const u = await activePlayer(userId, tx);
  return u.playerProfile?.displayName || u.name?.trim().split(/\s+/)[0]?.slice(0, 60) || "Player";
}
