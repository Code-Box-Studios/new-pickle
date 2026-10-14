import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking, seedCustomer } from "../factories";
import { addGuest, joinRoster, removePlayer, leaveRoster } from "@/lib/players/roster";
import { createInvitation, acceptInvitation, declineInvitation, revokeInvitation, lookupInvitation } from "@/lib/players/invitations";
import { rosterView } from "@/lib/players/read";
import { lockBooking } from "@/lib/booking/lock";

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

describe("Optional player rosters", () => {
  it("rechecks a stale holder mutation after a concurrent ownership transfer releases the booking lock", async () => {
    const b = await seedConfirmedBooking();
    const buyer = await seedCustomer();
    let entered!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const transfer = prisma.$transaction(async tx => {
      await lockBooking(tx,b.bookingId);
      await tx.booking.update({where:{id:b.bookingId},data:{userId:buyer.id}});
      entered(); await barrier;
    });
    await locked;
    const stale = addGuest(b.customerId,b.bookingId,"Stale guest");
    const rejection = expect(stale).rejects.toThrow(/holder|permission/i);
    release();
    await transfer; await rejection;
    expect(await prisma.bookingParticipant.count()).toBe(0);
    await addGuest(buyer.id,b.bookingId,"Buyer's guest");
  });
  it("accepts nickname-only guests and repeated names without accounts or contacts", async () => {
    const b = await seedConfirmedBooking();
    const a = await addGuest(b.customerId, b.bookingId, "Alex");
    const c = await addGuest(b.customerId, b.bookingId, "Alex");
    expect(a.participantId).not.toBe(c.participantId);
    const roster = await rosterView(b.customerId, b.bookingId);
    expect(roster.participants).toHaveLength(2);
    expect(roster.participants.every(p => p.isGuest)).toBe(true);
    expect(await prisma.user.count()).toBe(2);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.bookingId } })).status).toBe("CONFIRMED");
  });
  it("does not automatically add a booking holder and prevents private roster role bypass", async () => {
    const b = await seedConfirmedBooking();
    expect((await rosterView(b.customerId, b.bookingId)).selfParticipantId).toBeNull();
    await expect(rosterView(b.ownerId, b.bookingId)).rejects.toThrow(/access|permission/i);
    const stranger = await seedCustomer();
    await prisma.user.update({ where: { id: stranger.id }, data: { role: "ADMIN" } });
    await expect(addGuest(stranger.id, b.bookingId, "Guest")).rejects.toThrow(/holder|permission/i);
    await expect(joinRoster(stranger.id, b.bookingId)).rejects.toThrow(/invitation|holder/i);
  });
  it("joins only the acting holder and makes repeated self joins idempotent", async () => {
    const b = await seedConfirmedBooking();
    const a = await joinRoster(b.customerId, b.bookingId, "Me");
    expect(await joinRoster(b.customerId, b.bookingId, "Different")).toEqual(a);
    expect((await rosterView(b.customerId, b.bookingId)).participants[0].isMe).toBe(true);
    expect(await prisma.bookingParticipant.count()).toBe(1);
  });
  it("lets a player leave but removes participation access until fresh consent", async () => {
    const b = await seedConfirmedBooking();
    const u = await seedCustomer();
    const invite = await createInvitation(b.customerId, b.bookingId, "Friend");
    await acceptInvitation(u.id, invite.token, "Friend");
    await leaveRoster(u.id, b.bookingId);
    await expect(rosterView(u.id, b.bookingId)).rejects.toThrow(/access|permission/i);
    await expect(acceptInvitation(u.id, invite.token)).rejects.toThrow(/used|expired|available/i);
    await acceptInvitation(u.id, (await createInvitation(b.customerId, b.bookingId)).token, "Friend");
    expect((await rosterView(u.id, b.bookingId)).participants[0].isMe).toBe(true);
  });
  it("freezes roster edits when the game starts, using actual Manila time", async () => {
    const b = await seedConfirmedBooking();
    const a = await addGuest(b.customerId, b.bookingId, "Guest");
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: b.bookingId } });
    vi.spyOn(Date, "now").mockReturnValue(booking.startsAt.getTime() - 8 * 3600000);
    await expect(addGuest(b.customerId, b.bookingId, "Late")).rejects.toThrow(/started|roster/i);
    await expect(removePlayer(b.customerId, b.bookingId, a.participantId)).rejects.toThrow(/started|roster/i);
  });
});

describe("Player invitation consent", () => {
  it("stores only hashed tokens and gives public lookup no guest or contact details", async () => {
    const b = await seedConfirmedBooking();
    await addGuest(b.customerId, b.bookingId, "Private guest");
    const invite = await createInvitation(b.customerId, b.bookingId, "Private label");
    const stored = await prisma.playerInvitation.findUniqueOrThrow({ where: { id: invite.invitationId } });
    expect(JSON.stringify(stored)).not.toContain(invite.token);
    const view = JSON.stringify(await lookupInvitation(invite.token));
    expect(view).not.toContain("Private guest");
    expect(view).not.toContain("Private label");
    expect(view).not.toContain(b.customerId);
    expect(view).not.toContain("@t.test");
  });
  it("serializes acceptance so only one authenticated player can consume an invitation", async () => {
    const b = await seedConfirmedBooking();
    const invite = await createInvitation(b.customerId, b.bookingId);
    const [a, c] = await Promise.all([seedCustomer(), seedCustomer()]);
    const settled = await Promise.allSettled([acceptInvitation(a.id, invite.token, "A"), acceptInvitation(c.id, invite.token, "C")]);
    expect(settled.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.bookingParticipant.count()).toBe(1);
    const stored = await prisma.playerInvitation.findUniqueOrThrow({ where: { id: invite.invitationId } });
    expect([a.id, c.id]).toContain(stored.respondedById);
  });
  it("revocation, decline, expiration and changed reservations grant no membership", async () => {
    const b = await seedConfirmedBooking();
    const u = await seedCustomer();
    const a = await createInvitation(b.customerId, b.bookingId);
    await revokeInvitation(b.customerId, b.bookingId, a.invitationId);
    await expect(acceptInvitation(u.id, a.token)).rejects.toThrow(/available|revoked|expired/i);
    const c = await createInvitation(b.customerId, b.bookingId);
    await declineInvitation(u.id, c.token);
    await expect(acceptInvitation(u.id, c.token)).rejects.toThrow(/available|used|declined|expired/i);
    const d = await createInvitation(b.customerId, b.bookingId);
    await prisma.playerInvitation.update({ where: { id: d.invitationId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(lookupInvitation(d.token)).rejects.toThrow(/available|expired/i);
    const e = await createInvitation(b.customerId, b.bookingId);
    await prisma.booking.update({ where: { id: b.bookingId }, data: { status: "CANCELLED" } });
    await expect(acceptInvitation(u.id, e.token)).rejects.toThrow(/available|confirmed/i);
    expect(await prisma.bookingParticipant.count()).toBe(0);
  });
  it("bounds the optional roster and accepts no invitation before venue confirmation", async () => {
    const b = await seedConfirmedBooking();
    await prisma.booking.update({ where: { id: b.bookingId }, data: { status: "HELD" } });
    await addGuest(b.customerId, b.bookingId, "Guest");
    await expect(createInvitation(b.customerId, b.bookingId)).rejects.toThrow(/confirmed/i);
    await expect(addGuest(b.customerId, b.bookingId, "x".repeat(61))).rejects.toThrow(/60/i);
    await prisma.bookingParticipant.createMany({ data: Array.from({ length: 31 }, (_, i) => ({ bookingId: b.bookingId, nickname: `guest ${i}` })) });
    await expect(addGuest(b.customerId, b.bookingId, "Too many")).rejects.toThrow(/32/i);
  });
});
