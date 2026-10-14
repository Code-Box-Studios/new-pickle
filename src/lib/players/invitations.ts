import "server-only";
import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/booking/errors";
import { activePlayer, audit, assertHolder, bookingInclude, defaultNickname, limitPlayerWrites, withPlayerBooking, type PlayerBooking } from "./core";
import { actualTime, assertEditableRoster, text } from "./rules";
import { assertRosterSpace } from "./roster";
import type { InvitationView } from "./types";
import type { PlayerInvitation, Prisma } from "@/generated/prisma";

function tokenHash(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(token)) throw new NotFoundError("Invitation is unavailable or expired.");
  return createHash("sha256").update(token).digest("hex");
}
function assertAvailable(i: PlayerInvitation, b: PlayerBooking) {
  if (i.status !== "OPEN" || i.expiresAt.getTime() <= Date.now() || b.status !== "CONFIRMED" || b.userId !== i.createdById || b.startsAt.getTime() !== i.startsAt.getTime() || b.endsAt.getTime() !== i.endsAt.getTime() || actualTime(b.startsAt) <= Date.now()) throw new ConflictError("Invitation is unavailable, used, or expired.");
}
export async function createInvitation(userId: string, bookingId: string, label?: string) {
  const name = text(label, "Invitation label", 60, true);
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertHolder(b, userId); assertEditableRoster(b);
    if (b.status !== "CONFIRMED") throw new ConflictError("Invite registered players after the venue has confirmed this booking.");
    assertRosterSpace(b); await limitPlayerWrites(tx, userId);
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Math.min(Date.now() + 7 * 86400000, actualTime(b.startsAt)));
    const i = await tx.playerInvitation.create({ data: { bookingId, createdById: userId, tokenHash: tokenHash(token), label: name || null, expiresAt, startsAt: b.startsAt, endsAt: b.endsAt } });
    await audit(tx, userId, bookingId, "INVITE_CREATED", { invitationId: i.id });
    return { invitationId: i.id, token, expiresAt: expiresAt.toISOString() };
  });
}
export async function lookupInvitation(token: unknown): Promise<InvitationView> {
  const i = await prisma.playerInvitation.findUnique({ where: { tokenHash: tokenHash(token) }, include: { booking: { include: bookingInclude }, creator: { select: { isActive: true } } } });
  if (!i || !i.creator.isActive) throw new NotFoundError("Invitation is unavailable or expired.");
  assertAvailable(i, i.booking);
  return { venueName: i.booking.venue.name, courtName: i.booking.court.name, startsAt: i.startsAt.toISOString(), endsAt: i.endsAt.toISOString(), expiresAt: i.expiresAt.toISOString() };
}
async function withInvitation<T>(userId: string, token: unknown, fn: (tx: Prisma.TransactionClient, b: PlayerBooking, i: PlayerInvitation) => Promise<T>) {
  const key = await prisma.playerInvitation.findUnique({ where: { tokenHash: tokenHash(token) }, select: { id: true, bookingId: true } });
  if (!key) throw new NotFoundError("Invitation is unavailable or expired.");
  return withPlayerBooking(userId, key.bookingId, async (tx, b) => {
    const i = await tx.playerInvitation.findUniqueOrThrow({ where: { id: key.id } });
    await activePlayer(i.createdById, tx);
    return fn(tx, b, i);
  });
}
export async function acceptInvitation(userId: string, token: unknown, nickname?: string) {
  const name = text(nickname, "Nickname", 60, true);
  return withInvitation(userId, token, async (tx, b, i) => {
    const existing = b.participants.find(p => p.userId === userId);
    if (i.status === "ACCEPTED" && i.respondedById === userId && existing?.status === "ACTIVE") return { participantId: existing.id, bookingId: b.id };
    assertAvailable(i, b);
    if (b.userId === userId) throw new ConflictError("Use Add myself on your booking instead of accepting your own invitation.");
    if (existing?.status === "ACTIVE") throw new ConflictError("You are already on this roster.");
    await limitPlayerWrites(tx, userId);
    const p = await tx.bookingParticipant.upsert({ where: { bookingId_userId: { bookingId: b.id, userId } }, create: { bookingId: b.id, userId, nickname: name || await defaultNickname(userId, tx) }, update: { status: "ACTIVE", leftAt: null, nickname: name || await defaultNickname(userId, tx) } });
    await tx.playerInvitation.update({ where: { id: i.id }, data: { status: "ACCEPTED", respondedById: userId, respondedAt: new Date(Date.now()) } });
    await audit(tx, userId, b.id, "INVITE_ACCEPTED", { invitationId: i.id, participantId: p.id });
    return { participantId: p.id, bookingId: b.id };
  });
}
export async function declineInvitation(userId: string, token: unknown) {
  return withInvitation(userId, token, async (tx, b, i) => {
    assertAvailable(i, b); await limitPlayerWrites(tx, userId);
    await tx.playerInvitation.update({ where: { id: i.id }, data: { status: "DECLINED", respondedById: userId, respondedAt: new Date(Date.now()) } });
    await audit(tx, userId, b.id, "INVITE_DECLINED", { invitationId: i.id });
  });
}
export async function revokeInvitation(userId: string, bookingId: string, invitationId: string) {
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertHolder(b, userId);
    const i = b.playerInvitations.find(i => i.id === invitationId);
    if (!i) throw new NotFoundError("Invitation not found");
    if (i.status !== "OPEN") return;
    await limitPlayerWrites(tx, userId);
    await tx.playerInvitation.update({ where: { id: i.id }, data: { status: "REVOKED", respondedAt: new Date(Date.now()) } });
    await audit(tx, userId, b.id, "INVITE_REVOKED", { invitationId: i.id });
  });
}
