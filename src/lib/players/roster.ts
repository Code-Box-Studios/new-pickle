import "server-only";
import { ConflictError, NotFoundError, ForbiddenError } from "@/lib/booking/errors";
import { audit, assertHolder, defaultNickname, limitPlayerWrites, withPlayerBooking, type PlayerBooking } from "./core";
import { assertEditableRoster, MAX_ROSTER, text } from "./rules";

export function assertRosterSpace(b: PlayerBooking) {
  const size = b.participants.filter(p => p.status === "ACTIVE").length + b.playerInvitations.filter(i => i.status === "OPEN" && i.expiresAt.getTime() > Date.now()).length;
  if (size >= MAX_ROSTER) throw new ConflictError(`A session supports at most ${MAX_ROSTER} players and outstanding invitations.`);
}
export async function addGuest(userId: string, bookingId: string, nickname: unknown) {
  const name = text(nickname, "Guest nickname");
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertHolder(b, userId); assertEditableRoster(b); assertRosterSpace(b);
    if (b.participants.length >= 64) throw new ConflictError("This roster has reached its editing limit.");
    await limitPlayerWrites(tx, userId);
    const p = await tx.bookingParticipant.create({ data: { bookingId, nickname: name } });
    await audit(tx, userId, bookingId, "GUEST_ADDED", { participantId: p.id });
    return { participantId: p.id };
  });
}
export async function joinRoster(userId: string, bookingId: string, nickname?: string) {
  const name = text(nickname, "Nickname", 60, true);
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertHolder(b, userId); assertEditableRoster(b);
    const existing = b.participants.find(p => p.userId === userId);
    if (existing?.status === "ACTIVE") return { participantId: existing.id };
    assertRosterSpace(b); await limitPlayerWrites(tx, userId);
    const p = await tx.bookingParticipant.upsert({ where: { bookingId_userId: { bookingId, userId } }, create: { bookingId, userId, nickname: name || await defaultNickname(userId, tx) }, update: { status: "ACTIVE", leftAt: null, nickname: name || await defaultNickname(userId, tx) } });
    await audit(tx, userId, bookingId, "PLAYER_JOINED", { participantId: p.id });
    return { participantId: p.id };
  });
}
export async function removePlayer(userId: string, bookingId: string, participantId: string) {
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertHolder(b, userId); assertEditableRoster(b);
    const p = b.participants.find(p => p.id === participantId);
    if (!p) throw new NotFoundError("Player not found");
    if (p.status !== "ACTIVE") return;
    await limitPlayerWrites(tx, userId);
    await tx.bookingParticipant.update({ where: { id: p.id }, data: { status: "REMOVED", leftAt: new Date(Date.now()) } });
    await audit(tx, userId, bookingId, "PLAYER_REMOVED", { participantId: p.id });
  });
}
export async function leaveRoster(userId: string, bookingId: string) {
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertEditableRoster(b);
    const p = b.participants.find(p => p.userId === userId);
    if (!p) throw new ForbiddenError("You are not a participant in this session.");
    if (p.status !== "ACTIVE") return;
    await limitPlayerWrites(tx, userId);
    await tx.bookingParticipant.update({ where: { id: p.id }, data: { status: "LEFT", leftAt: new Date(Date.now()) } });
    await audit(tx, userId, bookingId, "PLAYER_LEFT", { participantId: p.id });
  });
}
