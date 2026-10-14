import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCustomer } from "../factories";
import { gameSetup, finish } from "./fixtures";
import { playerDashboard, updatePlayerProfile } from "@/lib/players/statistics";
import { createMatch, voteMatch, reviseMatch } from "@/lib/players/matches";
import { setAttendance } from "@/lib/players/attendance";
import { matchHistory } from "@/lib/players/read";
beforeEach(resetDb);

describe("Private player statistics", () => {
  it("keeps more than 20 unconfirmed and absent sessions discoverable with a private pending cursor", async () => {
    const o = await gameSetup();
    for (let day = 2; day <= 25; day++) {
      const b = await prisma.booking.create({ data: { reference: `PENDING-${day}`, venueId: o.venueId, courtId: o.courtId, userId: o.customerId, status: "COMPLETED", priceCents: 40000,
        startsAt: new Date(Date.now() - day * 86400000), endsAt: new Date(Date.now() - day * 86400000 + 3600000),
      } });
      await prisma.bookingParticipant.create({ data: { bookingId: b.id, userId: o.otherId, nickname: "Opponent", attendance: day % 2 ? "UNKNOWN" : "ABSENT", attendanceAt: day % 2 ? null : new Date() } });
    }
    const first = await playerDashboard(o.otherId);
    expect(first.pending).toHaveLength(20);
    expect(first).toHaveProperty("pendingNextCursor", expect.any(String));
    const second = await playerDashboard(o.otherId, undefined, first.pendingNextCursor!);
    expect(second.pending).toHaveLength(5);
    expect(second.pendingNextCursor).toBeNull();
    expect(new Set([...first.pending, ...second.pending].map(s => s.participantId)).size).toBe(25);
    expect([...first.pending, ...second.pending].some(s => s.attendance === "ABSENT")).toBe(true);
    await expect(playerDashboard(o.otherId, undefined, o.self)).rejects.toThrow(/cursor/i);
  });
  it("pages private history without truncating lifetime totals or accepting another player's cursor", async () => {
    const o = await gameSetup(); await finish(o);
    for (let day = 2; day <= 25; day++) {
      const b = await prisma.booking.create({ data: {
        reference: `HISTORY-${day}`, venueId: o.venueId, courtId: o.courtId, userId: o.customerId,
        status: "COMPLETED", priceCents: 40000,
        startsAt: new Date(Date.now() - day * 86400000), endsAt: new Date(Date.now() - day * 86400000 + 3600000),
      } });
      await prisma.bookingParticipant.create({ data: { bookingId: b.id, userId: o.customerId, nickname: "Me", attendance: "ATTENDED", attendanceAt: new Date() } });
    }
    const first = await playerDashboard(o.customerId);
    expect(first.totals.sessions).toBe(25);
    expect(first.history).toHaveLength(20);
    const second = await playerDashboard(o.customerId, first.nextCursor!);
    expect(second.history).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(second.totals.sessions).toBe(25);
    expect(new Set([...first.history, ...second.history].map(s => s.participantId)).size).toBe(25);
    await expect(playerDashboard(o.customerId, o.opponent)).rejects.toThrow(/cursor/i);
  });
  it("excludes completed future bookings even if attendance and result votes already exist", async () => {
    const o = await gameSetup(); await finish(o);
    await createMatch(o.customerId, o.bookingId, { format: "SINGLES", teamA: [o.self], teamB: [o.g1], winner: "A" });
    await prisma.booking.update({ where: { id: o.bookingId }, data: {
      startsAt: new Date(Date.now() + 9 * 3600000), endsAt: new Date(Date.now() + 10 * 3600000),
    } });
    const view = await playerDashboard(o.customerId);
    expect(view.totals.sessions).toBe(0);
    expect(view.totals.selfReported.matches).toBe(0);
    expect(view.history).toHaveLength(0);
    expect(view.pending[0].canConfirmAttendance).toBe(false);
  });
  it("requires registered teammates to confirm, with guest opponents kept self-reported", async () => {
    const o = await gameSetup(); await finish(o);
    const m = await createMatch(o.customerId, o.bookingId, { format: "DOUBLES", teamA: [o.self, o.opponent], teamB: [o.g1, o.g2], winner: "A" });
    expect((await playerDashboard(o.customerId)).totals.selfReported.matches).toBe(0);
    await voteMatch(o.otherId, m.matchId, 1, "CONFIRMED");
    expect((await playerDashboard(o.customerId)).totals.selfReported.wins).toBe(1);
    expect((await playerDashboard(o.customerId)).totals.confirmed.matches).toBe(0);
    expect((await playerDashboard(o.otherId)).totals.selfReported.wins).toBe(1);
  });
  it("counts neither reservations nor unconfirmed attendance as played sessions", async () => {
    const o = await gameSetup();
    expect((await playerDashboard(o.customerId)).totals.sessions).toBe(0);
    expect((await playerDashboard(o.customerId)).pending).toHaveLength(1);
    await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "COMPLETED", startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() - 80000000) } });
    expect((await playerDashboard(o.customerId)).totals.sessions).toBe(0);
    await setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED");
    const view = await playerDashboard(o.customerId);
    expect(view.totals.sessions).toBe(1);
    expect(view.totals.confirmed.winRate).toBeNull();
    expect(view.history).toHaveLength(1);
    expect(view.courts[0].sessions).toBe(1);
    expect(JSON.stringify(view)).not.toContain("customerMobile");
    expect(JSON.stringify(view)).not.toContain(o.otherId);
  });
  it("counts multiple games once, keeping peer-confirmed and guest games separate", async () => {
    const o = await gameSetup(); await finish(o);
    const input = { format: "SINGLES" as const, teamA: [o.self], teamB: [o.opponent], winner: "A" as const };
    const a = await createMatch(o.customerId, o.bookingId, input);
    const b = await createMatch(o.customerId, o.bookingId, { ...input, winner: "B" });
    await voteMatch(o.otherId, a.matchId, 1, "CONFIRMED");
    await voteMatch(o.otherId, b.matchId, 1, "CONFIRMED");
    await createMatch(o.customerId, o.bookingId, { ...input, teamB: [o.g1] });
    await createMatch(o.customerId, o.bookingId, { ...input, winner: "UNFINISHED" });
    const stats = (await playerDashboard(o.customerId)).totals;
    expect(stats.sessions).toBe(1);
    expect(stats.confirmed).toEqual({ wins: 1, losses: 1, matches: 2, winRate: 0.5 });
    expect(stats.selfReported).toEqual({ wins: 1, losses: 0, matches: 1, winRate: 1 });
    expect((await playerDashboard(o.otherId)).totals.confirmed.wins).toBe(1);
  });
  it("removes disputed/corrected results until the new revision receives fresh confirmations", async () => {
    const o = await gameSetup(); await finish(o);
    const input = { format: "SINGLES" as const, teamA: [o.self], teamB: [o.opponent], winner: "A" as const };
    const m = await createMatch(o.customerId, o.bookingId, input);
    await voteMatch(o.otherId, m.matchId, 1, "CONFIRMED");
    expect((await playerDashboard(o.customerId)).totals.confirmed.wins).toBe(1);
    await voteMatch(o.otherId, m.matchId, 1, "DISPUTED");
    expect((await playerDashboard(o.customerId)).totals.confirmed.matches).toBe(0);
    await reviseMatch(o.otherId, m.matchId, 1, { ...input, winner: "B" });
    expect((await playerDashboard(o.customerId)).totals.confirmed.matches).toBe(0);
    await voteMatch(o.customerId, m.matchId, 2, "CONFIRMED");
    expect((await playerDashboard(o.customerId)).totals.confirmed.losses).toBe(1);
    expect((await matchHistory(o.customerId, m.matchId)).revisions).toHaveLength(2);
    await expect(matchHistory((await seedCustomer()).id, m.matchId)).rejects.toThrow(/access|permission/i);
  });
  it("recalculates sessions and games after attendance corrections and cancellations", async () => {
    const o = await gameSetup(); await finish(o);
    await createMatch(o.customerId, o.bookingId, { format: "SINGLES", teamA: [o.self], teamB: [o.g1], winner: "A" });
    expect((await playerDashboard(o.customerId)).totals.selfReported.wins).toBe(1);
    await setAttendance(o.customerId, o.bookingId, o.self, "ABSENT");
    expect((await playerDashboard(o.customerId)).totals.sessions).toBe(0);
    expect((await playerDashboard(o.customerId)).totals.selfReported.matches).toBe(0);
    await setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED");
    await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "CANCELLED" } });
    expect((await playerDashboard(o.customerId)).totals.sessions).toBe(0);
    expect((await playerDashboard(o.customerId)).history).toHaveLength(0);
  });
  it("keeps profiles private, validates self-described levels, and grants no stats to other accounts", async () => {
    const o = await gameSetup(); await finish(o);
    await updatePlayerProfile(o.customerId, { displayName: "Ace", skillLevel: "INTERMEDIATE" });
    expect((await playerDashboard(o.customerId)).profile).toEqual({ displayName: "Ace", skillLevel: "INTERMEDIATE" });
    const stranger = await seedCustomer();
    expect((await playerDashboard(stranger.id)).totals.sessions).toBe(0);
    expect((await playerDashboard(stranger.id)).history).toHaveLength(0);
    await expect(updatePlayerProfile(stranger.id, { displayName: "Bad", skillLevel: "PRO" as never })).rejects.toThrow(/skill/i);
    await expect(updatePlayerProfile(stranger.id, { displayName: "x".repeat(61), skillLevel: null })).rejects.toThrow(/60/i);
  });
});
