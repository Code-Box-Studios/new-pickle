import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../db";
import { seedCustomer } from "../factories";
import { gameSetup } from "./fixtures";
import { createInvitation, acceptInvitation } from "@/lib/players/invitations";
import { addGuest, joinRoster } from "@/lib/players/roster";
import { rosterView } from "@/lib/players/read";
import { createListing, claimListing, markPaymentSent, transferTrade } from "@/lib/pasalo/service";
beforeEach(resetDb);

describe("Pasalo participant access", () => {
  it("revokes unused invitations and swaps holder control without changing accepted players or guests", async () => {
    const b = await gameSetup();
    const pending = await createInvitation(b.customerId, b.bookingId, "Pending player");
    await prisma.paymentSubmission.create({ data: { bookingId: b.bookingId, channel: "GCASH", reference: "original-paid", amountCents: 40000 } });
    const l = await createListing(b.customerId, { bookingId: b.bookingId, priceCents: 25000, paymentChannel: "GCASH", paymentAccountName: "Seller", paymentAccountNumber: "09171234567" });
    const buyer = await seedCustomer();
    const t = await claimListing(buyer.id, l.id, { customerName: "Buyer", customerMobile: "09181234567" });
    await markPaymentSent(buyer.id, t.id); await transferTrade(b.customerId, t.id);
    expect((await prisma.playerInvitation.findUniqueOrThrow({ where: { id: pending.invitationId } })).status).toBe("REVOKED");
    await expect(acceptInvitation((await seedCustomer()).id, pending.token)).rejects.toThrow(/available|revoked|expired/i);
    const next = await rosterView(buyer.id, b.bookingId);
    expect(next.isHolder).toBe(true); expect(next.selfParticipantId).toBeNull();
    expect(next.participants.map(p => p.id).sort()).toEqual([b.self, b.opponent, b.g1, b.g2].sort());
    expect((await rosterView(b.otherId, b.bookingId)).isHolder).toBe(false);
    // The seller explicitly joined earlier; participation remains distinct from ownership.
    expect((await rosterView(b.customerId, b.bookingId)).isHolder).toBe(false);
    await expect(addGuest(b.customerId, b.bookingId, "Unauthorized")).rejects.toThrow(/holder/i);
    await joinRoster(buyer.id, b.bookingId, "New player");
    expect((await rosterView(buyer.id, b.bookingId)).participants).toHaveLength(5);
  });
});
