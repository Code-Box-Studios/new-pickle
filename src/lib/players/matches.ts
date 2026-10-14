import "server-only";
import { createHash, randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { assertRosterAccess, audit, limitPlayerWrites, withPlayerBooking, type PlayerBooking, type Tx } from "./core";
import { assertFinished, validateMatch } from "./rules";
import { revisionInclude } from "./read";
import type { Decision, MatchInput } from "./types";

function assertRevision(expected: number, current: number) {
  if (!Number.isInteger(expected) || expected < 1) throw new ValidationError("A result revision is required.");
  if (expected !== current) throw new ConflictError("This result changed. Refresh and review the latest revision.");
}
function assertPlayers(b: PlayerBooking, input: Pick<MatchInput, "teamA" | "teamB">) {
  for (const id of [...input.teamA, ...input.teamB]) {
    const p = b.participants.find(p => p.id === id && p.status === "ACTIVE");
    if (!p) throw new ValidationError("Every selected player must be in this session's active roster.");
    if (p.attendance !== "ATTENDED") throw new ConflictError("Confirm or report attendance for every selected player before recording this result.");
  }
}
async function writeRevision(tx: Tx, b: PlayerBooking, userId: string, matchId: string, number: number, input: ReturnType<typeof validateMatch>) {
  const r = await tx.playerMatchRevision.create({ data: { matchId, number, authoredById: userId, format: input.format, winner: input.winner, scoreA: input.scoreA, scoreB: input.scoreB, note: input.note,
    players: { create: [...input.teamA.map(participantId => ({ participantId, team: "A" as const })), ...input.teamB.map(participantId => ({ participantId, team: "B" as const }))] } } });
  const me = b.participants.find(p => p.userId === userId && p.status === "ACTIVE" && p.attendance === "ATTENDED");
  if (me && [...input.teamA, ...input.teamB].includes(me.id)) await tx.playerMatchVote.create({ data: { revisionId: r.id, userId, decision: "CONFIRMED" } });
  return r;
}
export async function createMatch(userId: string, bookingId: string, input: MatchInput, submissionId: string = randomUUID()) {
  const result = validateMatch(input);
  if (typeof submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) throw new ValidationError("A valid game submission ID is required.");
  const submissionHash = createHash("sha256").update(JSON.stringify({ ...result, teamA: [...result.teamA].sort(), teamB: [...result.teamB].sort() })).digest("hex");
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertRosterAccess(b, userId); assertFinished(b);
    const replay = await tx.playerMatch.findFirst({ where: { session: { bookingId }, createdById: userId, submissionId } });
    if (replay) {
      if (replay.submissionHash !== submissionHash) throw new ConflictError("This game submission was already saved with different details. Refresh before recording another game.");
      return { matchId: replay.id, revision: replay.currentRevision };
    }
    assertPlayers(b, result);
    if (b.userId !== userId && !b.participants.some(p => p.userId === userId && p.status === "ACTIVE" && p.attendance === "ATTENDED")) throw new ForbiddenError("Confirm your attendance before recording games.");
    if (await tx.playerMatch.count({ where: { session: { bookingId } } }) >= 100) throw new ConflictError("A session supports up to 100 games.");
    await limitPlayerWrites(tx, userId);
    const s = await tx.playSession.upsert({ where: { bookingId }, create: { bookingId }, update: {} });
    const m = await tx.playerMatch.create({ data: { sessionId: s.id, createdById: userId, submissionId, submissionHash } });
    await writeRevision(tx, b, userId, m.id, 1, result);
    await audit(tx, userId, bookingId, "MATCH_CREATED", { matchId: m.id, revision: 1 });
    return { matchId: m.id, revision: 1 };
  });
}
export async function withMatch<T>(userId: string, matchId: string, fn: (tx: Tx, b: PlayerBooking, match: Prisma.PlayerMatchGetPayload<{ include: { revisions: { include: typeof revisionInclude } } }>) => Promise<T>) {
  const key = await prisma.playerMatch.findUnique({ where: { id: matchId }, select: { session: { select: { bookingId: true } } } });
  if (!key) throw new NotFoundError("Game not found");
  return withPlayerBooking(userId, key.session.bookingId, async (tx, b) => {
    assertRosterAccess(b, userId);
    const m = await tx.playerMatch.findUniqueOrThrow({ where: { id: matchId }, include: { revisions: { orderBy: { number: "desc" }, take: 1, include: revisionInclude } } });
    return fn(tx, b, m);
  });
}
export async function reviseMatch(userId: string, matchId: string, expectedRevision: number, input: MatchInput) {
  const result = validateMatch(input);
  return withMatch(userId, matchId, async (tx, b, m) => {
    assertFinished(b); assertRevision(expectedRevision, m.currentRevision);
    if (b.userId !== userId && !m.revisions[0].players.some(p => p.participant.userId === userId)) throw new ForbiddenError("Only this result's players or the booking holder can propose a correction.");
    assertPlayers(b, result); await limitPlayerWrites(tx, userId);
    const number = m.currentRevision + 1;
    await writeRevision(tx, b, userId, m.id, number, result);
    await tx.playerMatch.update({ where: { id: m.id }, data: { currentRevision: number } });
    await audit(tx, userId, b.id, "MATCH_REVISED", { matchId: m.id, previousRevision: m.currentRevision, revision: number });
    return { revision: number };
  });
}
export async function voteMatch(userId: string, matchId: string, expectedRevision: number, decision: Decision) {
  if (decision !== "CONFIRMED" && decision !== "DISPUTED") throw new ValidationError("Choose confirm or dispute.");
  return withMatch(userId, matchId, async (tx, b, m) => {
    assertFinished(b); assertRevision(expectedRevision, m.currentRevision);
    const r = m.revisions[0];
    const me = r.players.find(p => p.participant.userId === userId && p.participant.status === "ACTIVE");
    if (!me) throw new ForbiddenError("Only registered participants in this game can confirm or dispute its result.");
    if (decision === "CONFIRMED" && r.votes.some(v => v.decision === "DISPUTED")) throw new ConflictError("Resolve the dispute with a new result revision and fresh confirmations.");
    if (decision === "CONFIRMED" && me.participant.attendance !== "ATTENDED") throw new ConflictError("Confirm your attendance before confirming a game.");
    if (r.votes.some(v => v.userId === userId && v.decision === decision)) return;
    await limitPlayerWrites(tx, userId);
    await tx.playerMatchVote.create({ data: { revisionId: r.id, userId, decision } });
    await audit(tx, userId, b.id, decision === "CONFIRMED" ? "MATCH_CONFIRMED" : "MATCH_DISPUTED", { matchId: m.id, revision: m.currentRevision });
  });
}
