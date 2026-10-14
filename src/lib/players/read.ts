import "server-only";
import type { BookingParticipant, Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/booking/errors";
import { assertRosterAccess, withPlayerBooking, type PlayerBooking } from "./core";
import { canEditRoster, hasFinished } from "./rules";
import type { MatchView, ParticipantView, RevisionView, RosterView, SessionBookingView, Verification } from "./types";

export const revisionInclude = { players: { include: { participant: true } }, votes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } satisfies Prisma.PlayerMatchRevisionInclude;
export type Revision = Prisma.PlayerMatchRevisionGetPayload<{ include: typeof revisionInclude }>;
export function participantView(p: BookingParticipant, userId: string): ParticipantView {
  return { id: p.id, nickname: p.nickname, isGuest: p.userId === null, isMe: p.userId === userId, attendance: p.attendance };
}

export async function matchHistory(userId: string, matchId: string, before?: number) {
  if (before !== undefined && (!Number.isInteger(before) || before < 1)) throw new ValidationError("Invalid revision cursor.");
  const key = await prisma.playerMatch.findUnique({ where: { id: matchId }, select: { session: { select: { bookingId: true } } } });
  if (!key) throw new NotFoundError("Game not found");
  return withPlayerBooking(userId, key.session.bookingId, async (tx, b) => {
    assertRosterAccess(b, userId);
    const rows = await tx.playerMatchRevision.findMany({ where: { matchId, ...(before ? { number: { lt: before } } : {}) }, include: revisionInclude, orderBy: { number: "desc" }, take: 21 });
    return { revisions: rows.slice(0, 20).map(r => revisionView(r, userId)), hasOlder: rows.length > 20 };
  });
}
export function sessionBookingView(b: Pick<PlayerBooking, "id" | "startsAt" | "endsAt" | "status" | "venue" | "court">): SessionBookingView {
  return { id: b.id, venueName: b.venue.name, courtName: b.court.name, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), status: b.status };
}
export function verification(r: Revision): Verification {
  if (r.votes.some(v => v.decision === "DISPUTED")) return "DISPUTED";
  if (r.winner === "UNFINISHED") return "UNFINISHED";
  if (r.players.some(p => p.participant.status !== "ACTIVE" || p.participant.attendance !== "ATTENDED")) return "PENDING";
  const registered = r.players.filter(p => p.participant.userId !== null);
  if (registered.some(p => !r.votes.some(v => v.userId === p.participant.userId && v.decision === "CONFIRMED"))) return "PENDING";
  return new Set(registered.map(p => p.team)).size >= 2 ? "PEER_CONFIRMED" : "SELF_REPORTED";
}
export function revisionView(r: Revision, userId: string): RevisionView {
  return { number: r.number, format: r.format, teamA: r.players.filter(p => p.team === "A").map(p => participantView(p.participant, userId)), teamB: r.players.filter(p => p.team === "B").map(p => participantView(p.participant, userId)), winner: r.winner, scoreA: r.scoreA, scoreB: r.scoreB, note: r.note, createdAt: r.createdAt.toISOString(), votes: r.votes.map(v => ({ nickname: r.players.find(p => p.participant.userId === v.userId)?.participant.nickname || "Player", decision: v.decision })) };
}

export async function rosterView(userId: string, bookingId: string): Promise<RosterView> {
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertRosterAccess(b, userId);
    const me = b.participants.find(p => p.userId === userId && p.status === "ACTIVE");
    const editable = canEditRoster(b), finished = hasFinished(b), holder = b.userId === userId;
    const games = await tx.playerMatch.findMany({ where: { session: { bookingId } }, include: { revisions: { orderBy: { number: "desc" }, take: 1, include: revisionInclude } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
    const matches: MatchView[] = games.map(m => {
      const r = m.revisions[0];
      const mine = r.players.some(p => p.participant.userId === userId);
      const ownVotes = r.votes.filter(v => v.userId === userId);
      return { ...revisionView(r, userId), id: m.id, verification: verification(r), canEdit: finished && (holder || mine), canVote: finished && mine && me?.attendance === "ATTENDED" && !r.votes.some(v => v.decision === "DISPUTED"), canDispute: finished && mine && !r.votes.some(v => v.decision === "DISPUTED"), myDecision: ownVotes.find(v => v.decision === "DISPUTED")?.decision || ownVotes[0]?.decision || null, revisionCount: m.currentRevision };
    });
    return { booking: sessionBookingView(b), isHolder: holder, canEdit: editable && holder, canInvite: editable && holder && b.status === "CONFIRMED", canRecord: finished && (holder || me?.attendance === "ATTENDED"), canConfirmAttendance: finished, selfParticipantId: me?.id ?? null,
      participants: b.participants.filter(p => p.status === "ACTIVE").map(p => participantView(p, userId)),
      invitations: holder ? b.playerInvitations.map(i => ({ id: i.id, label: i.label, status: i.status === "OPEN" && i.expiresAt.getTime() <= Date.now() ? "EXPIRED" : i.status, expiresAt: i.expiresAt.toISOString() })) : [], matches };
  });
}
