import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { activePlayer, audit, defaultNickname, limitPlayerWrites } from "./core";
import { hasFinished, text } from "./rules";
import { sessionBookingView } from "./read";
import type { PlayerDashboardView, PlayerProfileView, ResultTotals, SkillLevel } from "./types";

export async function updatePlayerProfile(userId: string, input: { displayName: string; skillLevel: SkillLevel | null }): Promise<PlayerProfileView> {
  const displayName = text(input.displayName, "Display name");
  if (input.skillLevel !== null && !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(input.skillLevel)) throw new ValidationError("Choose a self-described skill level or leave it unspecified.");
  return prisma.$transaction(async tx => {
    await activePlayer(userId, tx); await limitPlayerWrites(tx, userId);
    const profile = await tx.playerProfile.upsert({ where: { userId }, create: { userId, displayName, skillLevel: input.skillLevel }, update: { displayName, skillLevel: input.skillLevel } });
    await audit(tx, userId, null, "PROFILE_UPDATED");
    return { displayName: profile.displayName, skillLevel: profile.skillLevel };
  });
}

function totals(wins: number, losses: number): ResultTotals { return { wins, losses, matches: wins + losses, winRate: wins + losses ? wins / (wins + losses) : null }; }
interface StatsRow { venueId: string; venueName: string; courtId: string; courtName: string; sessions: number; confirmedWins: number; confirmedLosses: number; reportedWins: number; reportedLosses: number }

/** Aggregate the entire eligible history; pagination never changes lifetime totals. */
async function statistics(userId: string) {
  const civilNow = new Date(Date.now() + 8 * 3600000);
  const rows = await prisma.$queryRaw<StatsRow[]>`
    WITH eligible AS (
      SELECT p.id AS "participantId", b.id AS "bookingId", b."venueId", b."courtId"
      FROM booking_participants p JOIN bookings b ON b.id = p."bookingId"
      WHERE p."userId" = ${userId} AND p.status = 'ACTIVE' AND p.attendance = 'ATTENDED'
        AND b.status = 'COMPLETED' AND b."endsAt" <= ${civilNow}
    ), games AS (
      SELECT e."participantId", m.id AS "matchId", r.winner, mine.team,
        (SELECT count(DISTINCT rp.team) FROM player_match_members rp
          JOIN booking_participants pp ON pp.id = rp."participantId"
          WHERE rp."revisionId" = r.id AND pp."userId" IS NOT NULL) >= 2 AS peer
      FROM eligible e JOIN play_sessions s ON s."bookingId" = e."bookingId"
      JOIN player_matches m ON m."sessionId" = s.id
      JOIN player_match_revisions r ON r."matchId" = m.id AND r.number = m."currentRevision"
      JOIN player_match_members mine ON mine."revisionId" = r.id AND mine."participantId" = e."participantId"
      WHERE r.winner IN ('A', 'B')
        AND NOT EXISTS (SELECT 1 FROM player_match_votes v WHERE v."revisionId" = r.id AND v.decision = 'DISPUTED')
        AND NOT EXISTS (
          SELECT 1 FROM player_match_members mp JOIN booking_participants p ON p.id = mp."participantId"
          WHERE mp."revisionId" = r.id AND (p.status != 'ACTIVE' OR p.attendance != 'ATTENDED' OR
            (p."userId" IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM player_match_votes v WHERE v."revisionId" = r.id AND v."userId" = p."userId" AND v.decision = 'CONFIRMED'
            )))
        )
    )
    SELECT e."venueId", v.name AS "venueName", e."courtId", c.name AS "courtName",
      count(DISTINCT e."bookingId")::int AS sessions,
      count(g."matchId") FILTER (WHERE g.peer AND g.winner::text = g.team::text)::int AS "confirmedWins",
      count(g."matchId") FILTER (WHERE g.peer AND g.winner::text != g.team::text)::int AS "confirmedLosses",
      count(g."matchId") FILTER (WHERE NOT g.peer AND g.winner::text = g.team::text)::int AS "reportedWins",
      count(g."matchId") FILTER (WHERE NOT g.peer AND g.winner::text != g.team::text)::int AS "reportedLosses"
    FROM eligible e JOIN venues v ON v.id = e."venueId" JOIN courts c ON c.id = e."courtId"
    LEFT JOIN games g ON g."participantId" = e."participantId"
    GROUP BY e."venueId", v.name, e."courtId", c.name ORDER BY sessions DESC, v.name, c.name
  `;
  const sum = (key: "sessions" | "confirmedWins" | "confirmedLosses" | "reportedWins" | "reportedLosses") => rows.reduce((n, row) => n + row[key], 0);
  return { courts: rows.map(r => ({ venueId: r.venueId, venueName: r.venueName, courtId: r.courtId, courtName: r.courtName, sessions: r.sessions, confirmed: totals(r.confirmedWins, r.confirmedLosses), selfReported: totals(r.reportedWins, r.reportedLosses) })),
    totals: { sessions: sum("sessions"), venues: new Set(rows.map(r => r.venueId)).size, courts: rows.length, confirmed: totals(sum("confirmedWins"), sum("confirmedLosses")), selfReported: totals(sum("reportedWins"), sum("reportedLosses")) } };
}

export async function playerDashboard(userId: string, before?: string, pendingBefore?: string): Promise<PlayerDashboardView> {
  const u = await activePlayer(userId);
  let older = {};
  if (before) {
    const cursor = await prisma.bookingParticipant.findFirst({ where: { id: before, userId, status: "ACTIVE", attendance: "ATTENDED", booking: { status: "COMPLETED", endsAt: { lte: new Date(Date.now() + 8 * 3600000) } } }, include: { booking: { select: { endsAt: true } } } });
    if (!cursor) throw new ValidationError("Invalid playing-history cursor.");
    older = { OR: [{ booking: { endsAt: { lt: cursor.booking.endsAt } } }, { booking: { endsAt: cursor.booking.endsAt }, id: { lt: cursor.id } }] };
  }
  const history = await prisma.bookingParticipant.findMany({ where: { userId, status: "ACTIVE", attendance: "ATTENDED", booking: { status: "COMPLETED", endsAt: { lte: new Date(Date.now() + 8 * 3600000) } }, ...older }, include: { booking: { include: { venue: true, court: true } } }, orderBy: [{ booking: { endsAt: "desc" } }, { id: "desc" }], take: 21 });
  const pendingWhere: Prisma.BookingParticipantWhereInput = { userId, status: "ACTIVE", booking: { status: { in: ["CONFIRMED", "COMPLETED"] } }, OR: [{ attendance: { not: "ATTENDED" } }, { booking: { endsAt: { gt: new Date(Date.now() + 8 * 3600000) } } }] };
  let pendingOlder: Prisma.BookingParticipantWhereInput = {};
  if (pendingBefore) {
    const cursor = await prisma.bookingParticipant.findFirst({ where: { AND: [pendingWhere, { id: pendingBefore }] }, include: { booking: { select: { startsAt: true } } } });
    if (!cursor) throw new ValidationError("Invalid pending-session cursor.");
    pendingOlder = { OR: [{ booking: { startsAt: { lt: cursor.booking.startsAt } } }, { booking: { startsAt: cursor.booking.startsAt }, id: { lt: cursor.id } }] };
  }
  const pending = await prisma.bookingParticipant.findMany({ where: { AND: [pendingWhere, pendingOlder] }, include: { booking: { include: { venue: true, court: true } } }, orderBy: [{ booking: { startsAt: "desc" } }, { id: "desc" }], take: 21 });
  const view = (p: typeof history[number]) => ({ participantId: p.id, booking: sessionBookingView(p.booking), attendance: p.attendance, canConfirmAttendance: hasFinished(p.booking) });
  const summary = await statistics(userId);
  return { profile: { displayName: u.playerProfile?.displayName || await defaultNickname(userId, prisma), skillLevel: u.playerProfile?.skillLevel ?? null }, ...summary, history: history.slice(0, 20).map(view), nextCursor: history.length > 20 ? history[19].id : null, pending: pending.slice(0, 20).map(view), pendingNextCursor: pending.length > 20 ? pending[19].id : null };
}
