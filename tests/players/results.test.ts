import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCustomer } from "../factories";
import { setAttendance } from "@/lib/players/attendance";
import { createMatch, reviseMatch, voteMatch } from "@/lib/players/matches";
import { rosterView } from "@/lib/players/read";
import { gameSetup, finish } from "./fixtures";

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

describe("Player attendance", () => {
  it("requires actual session end and completion, then allows only self or holder-reported guests", async () => {
    const o = await gameSetup();
    await expect(setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED")).rejects.toThrow(/completed|ended/i);
    await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "COMPLETED" } });
    await expect(setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED")).rejects.toThrow(/ended/i);
    await finish(o);
    await expect(setAttendance(o.customerId, o.bookingId, o.opponent, "ABSENT")).rejects.toThrow(/own|permission/i);
    await expect(setAttendance(o.otherId, o.bookingId, o.g1, "ABSENT")).rejects.toThrow(/holder|permission/i);
    await setAttendance(o.otherId, o.bookingId, o.opponent, "ABSENT");
    expect((await rosterView(o.customerId, o.bookingId)).participants.find(p => p.id === o.opponent)?.attendance).toBe("ABSENT");
    expect(await prisma.playerAudit.count({ where: { bookingId: o.bookingId, action: "ATTENDANCE_CHANGED" } })).toBe(5);
  });
  it("uses the Manila civil timestamp convention at the exact end boundary", async () => {
    const o = await gameSetup();
    const now = Date.now();
    await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "COMPLETED", startsAt: new Date(now + 7 * 3600000), endsAt: new Date(now + 8 * 3600000 + 60000) } });
    vi.spyOn(Date, "now").mockReturnValue(now);
    await expect(setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED")).rejects.toThrow(/ended/i);
    vi.spyOn(Date, "now").mockReturnValue(now + 60000);
    await setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED");
  });
});

describe("Match revisions and confirmations", () => {
  it("replays a submitted game once, rejecting changed payloads while allowing separate identical games", async () => {
    const o = await gameSetup(); await finish(o);
    const input = { format: "SINGLES" as const, teamA: [o.self], teamB: [o.g1], winner: "A" as const };
    const key = "6e30fe7e-0b64-4997-90bf-788b51b2a561";
    const [first, replay] = await Promise.all([
      createMatch(o.customerId, o.bookingId, input, key),
      createMatch(o.customerId, o.bookingId, input, key),
    ]);
    expect(replay).toEqual(first);
    expect(await prisma.playerMatch.count()).toBe(1);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, winner: "B" }, key)).rejects.toThrow(/submission|different|changed/i);
    await createMatch(o.customerId, o.bookingId, input, "6e30fe7e-0b64-4997-90bf-788b51b2a562");
    expect(await prisma.playerMatch.count()).toBe(2);
  });
  it("lets a matched player dispute after correcting their attendance to absent", async () => {
    const o = await gameSetup(); await finish(o);
    const m = await createMatch(o.customerId, o.bookingId, { format: "SINGLES", teamA: [o.self], teamB: [o.opponent], winner: "A" });
    await setAttendance(o.otherId, o.bookingId, o.opponent, "ABSENT");
    const game = (await rosterView(o.otherId, o.bookingId)).matches[0];
    expect(game.canVote).toBe(false);
    expect(game).toHaveProperty("canDispute", true);
    await voteMatch(o.otherId, m.matchId, 1, "DISPUTED");
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("DISPUTED");
  });
  it("needs attended players, valid team sizes and distinct members", async () => {
    const o = await gameSetup();
    const input = { format: "SINGLES" as const, teamA: [o.self], teamB: [o.opponent], winner: "A" as const };
    await expect(createMatch(o.customerId, o.bookingId, input)).rejects.toThrow(/completed|ended/i);
    await finish(o);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, teamB: [o.self] })).rejects.toThrow(/distinct/i);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, format: "DOUBLES" })).rejects.toThrow(/2 players/i);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, teamB: ["other-booking"] })).rejects.toThrow(/roster|session/i);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, scoreA: 1, scoreB: 11 })).rejects.toThrow(/higher/i);
    await expect(createMatch(o.customerId, o.bookingId, { ...input, scoreA: 11 })).rejects.toThrow(/both scores/i);
    await setAttendance(o.otherId, o.bookingId, o.opponent, "UNKNOWN");
    await expect(createMatch(o.customerId, o.bookingId, input)).rejects.toThrow(/attendance/i);
  });
  it("confirms a decided game only after every registered player accepts the same revision", async () => {
    const o = await gameSetup(); await finish(o);
    const m = await createMatch(o.customerId, o.bookingId, { format: "DOUBLES", teamA: [o.self, o.g1], teamB: [o.opponent, o.g2], winner: "A", scoreA: 11, scoreB: 7 });
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("PENDING");
    await voteMatch(o.otherId, m.matchId, 1, "CONFIRMED");
    await voteMatch(o.otherId, m.matchId, 1, "CONFIRMED");
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("PEER_CONFIRMED");
    expect(await prisma.playerMatchVote.count()).toBe(2);
    await expect(voteMatch((await seedCustomer()).id, m.matchId, 1, "CONFIRMED")).rejects.toThrow(/participant|permission/i);
  });
  it("keeps guest games self-reported and unfinished games outside decided totals", async () => {
    const o = await gameSetup(); await finish(o);
    await createMatch(o.customerId, o.bookingId, { format: "SINGLES", teamA: [o.self], teamB: [o.g1], winner: "B" });
    await createMatch(o.customerId, o.bookingId, { format: "SINGLES", teamA: [o.g1], teamB: [o.g2], winner: "UNFINISHED" });
    const games = (await rosterView(o.customerId, o.bookingId)).matches;
    expect(games.map(m => m.verification)).toContain("SELF_REPORTED");
    expect(games.map(m => m.verification)).toContain("UNFINISHED");
  });
  it("stores disputes and old revisions while corrections require fresh confirmations", async () => {
    const o = await gameSetup(); await finish(o);
    const input = { format: "SINGLES" as const, teamA: [o.self], teamB: [o.opponent], winner: "A" as const };
    const m = await createMatch(o.customerId, o.bookingId, input);
    await voteMatch(o.otherId, m.matchId, 1, "CONFIRMED");
    await voteMatch(o.otherId, m.matchId, 1, "DISPUTED");
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("DISPUTED");
    await expect(voteMatch(o.customerId, m.matchId, 1, "CONFIRMED")).rejects.toThrow(/revision|dispute/i);
    await reviseMatch(o.otherId, m.matchId, 1, { ...input, winner: "B", note: "Corrected result" });
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("PENDING");
    await expect(voteMatch(o.customerId, m.matchId, 1, "CONFIRMED")).rejects.toThrow(/changed|revision/i);
    await voteMatch(o.customerId, m.matchId, 2, "CONFIRMED");
    expect((await rosterView(o.customerId, o.bookingId)).matches[0].verification).toBe("PEER_CONFIRMED");
    expect(await prisma.playerMatchRevision.count()).toBe(2);
    expect(await prisma.playerMatchVote.count({ where: { decision: "DISPUTED" } })).toBe(1);
  });
});
