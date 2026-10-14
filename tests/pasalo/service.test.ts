import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking, seedCustomer } from "../factories";
import { createListing, claimListing, markPaymentSent, transferTrade, releaseTrade, withdrawListing, postMessage } from "@/lib/pasalo/service";
import { publicListing, tradeThread, marketListings, myPasalo, sellerConversations } from "@/lib/pasalo/read";

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

async function offer() {
  const b = await seedConfirmedBooking();
  await prisma.paymentSubmission.create({ data: { bookingId: b.bookingId, channel: "GCASH", reference: "ORIGINAL-PRIVATE", proofKey: "private-proof", amountCents: 40000 } });
  const input = { bookingId: b.bookingId, priceCents: 25000, paymentChannel: "GCASH" as const, paymentAccountName: "Casey", paymentAccountNumber: "09171234567" };
  const listing = await createListing(b.customerId, input);
  const buyer = await seedCustomer();
  return { ...b, listing, buyer, input };
}
const contact = { customerName: "Buyer", customerMobile: "09181234567" };

describe("Pasalo eligibility and private offers", () => {
  it("lists only paid confirmed reservations at a lower price", async () => {
    const b = await seedConfirmedBooking();
    const input = { bookingId: b.bookingId, priceCents: 25000, paymentChannel: "MAYA" as const, paymentAccountName: "Casey", paymentAccountNumber: "09171234567" };
    await expect(createListing(b.customerId, input)).rejects.toThrow(/paid/i);
    await prisma.paymentSubmission.create({ data: { bookingId: b.bookingId, channel: "MAYA", reference: "r", amountCents: 40000 } });
    await expect(createListing(b.customerId, { ...input, priceCents: 40000 })).rejects.toThrow(/lower/i);
    await expect(createListing(b.customerId, { ...input, priceCents: -1 })).rejects.toThrow(/price/i);
    await expect(createListing(b.customerId, { ...input, priceCents: 1.5 })).rejects.toThrow(/price/i);
    await expect(createListing((await seedCustomer()).id, input)).rejects.toThrow(/own|permission/i);
  });
  it("rejects unavailable venue, remote booking, and inactive seller", async () => {
    const o = await offer();
    await withdrawListing(o.customerId, o.listing.id);
    await prisma.booking.update({ where: { id: o.bookingId }, data: { backendType: "SENTRY" } });
    await expect(createListing(o.customerId, o.input)).rejects.toThrow(/local|transfer/i);
    await prisma.booking.update({ where: { id: o.bookingId }, data: { backendType: "LOCAL" } });
    await prisma.venue.update({ where: { id: o.venueId }, data: { isPublished: false } });
    await expect(createListing(o.customerId, o.input)).rejects.toThrow(/venue|available/i);
    await prisma.venue.update({ where: { id: o.venueId }, data: { isPublished: true } });
    await prisma.user.update({ where: { id: o.customerId }, data: { isActive: false } });
    await expect(createListing(o.customerId, o.input)).rejects.toThrow(/account/i);
  });
  it("applies cutoff to real Manila time, not stored civil timestamps", async () => {
    const o = await offer();
    await withdrawListing(o.customerId, o.listing.id);
    const now = Date.now();
    await prisma.booking.update({ where: { id: o.bookingId }, data: { startsAt: new Date(now + 8 * 3600000 + 29 * 60000), endsAt: new Date(now + 10 * 3600000) } });
    await expect(createListing(o.customerId, o.input)).rejects.toThrow(/30 minutes/i);
  });
  it("public payloads contain no payment account, booking id or original receipt", async () => {
    const o = await offer();
    const detail = await publicListing(o.listing.id, o.buyer.id);
    const serialized = JSON.stringify(detail);
    for (const secret of [o.bookingId, o.reference, "ORIGINAL-PRIVATE", "09171234567", "+639171234567", "paymentAccount"]) expect(serialized).not.toContain(secret);
    expect((await marketListings("Davao City"))[0].priceCents).toBe(25000);
  });
});

describe("Pasalo claims, messages and transfers", () => {
  it("paginates seller conversation history and rejects other players and foreign cursors", async () => {
    const o = await offer();
    const snapshot = (await publicListing(o.listing.id)).listing;
    await prisma.pasaloTrade.createMany({ data: Array.from({ length: 23 }, (_, i) => ({
      id: `history-${i.toString().padStart(2, "0")}`, listingId: o.listing.id, buyerId: o.buyer.id, priceCents: 25000, customerName: "Buyer", customerMobile: "+639181234567", listingSnapshot: { ...snapshot }, paymentChannel: "GCASH", paymentAccountName: "Seller", paymentAccountNumber: "+639171234567", status: "RELEASED", expiresAt: new Date(Date.now() - 1), createdAt: new Date(Date.now() - i * 60000),
    })) });
    const mine = await myPasalo(o.customerId);
    const first = mine.selling[0];
    expect(first.conversations).toHaveLength(20);
    expect(first.hasOlderConversations).toBe(true);
    const more = await sellerConversations(o.customerId, o.listing.id, first.conversations[19].id);
    expect(more.conversations).toHaveLength(3);
    expect(more.hasOlder).toBe(false);
    await expect(sellerConversations(o.buyer.id, o.listing.id, first.conversations[19].id)).rejects.toThrow(/seller/i);
    await expect(sellerConversations(o.customerId, o.listing.id, "foreign-cursor")).rejects.toThrow(/cursor/i);
  });
  it("preserves a previous claim's wallet, time and price when the seller relists", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    const before = await tradeThread(o.buyer.id, t.id);
    await withdrawListing(o.customerId, o.listing.id);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId } });
    await prisma.booking.update({ where: { id: o.bookingId }, data: { startsAt: new Date(b.startsAt.getTime() + 86400000), endsAt: new Date(b.endsAt.getTime() + 86400000) } });
    await createListing(o.customerId, { ...o.input, priceCents: 20000, paymentAccountNumber: "09191234567" });
    const after = await tradeThread(o.buyer.id, t.id);
    expect(after.trade.status).toBe("VOIDED");
    expect(after.payment).toEqual(before.payment);
    expect(after.listing.startsAt).toBe(before.listing.startsAt);
    expect(after.listing.priceCents).toBe(before.listing.priceCents);
    await claimListing((await seedCustomer()).id, o.listing.id, contact);
    const mine = await myPasalo(o.customerId);
    expect(mine.selling[0].conversations.map(c => c.id)).toContain(t.id);
    expect(mine.selling[0].conversations).toHaveLength(2);
  });
  it("serializes competing claims and keeps the original reservation occupied", async () => {
    const o = await offer();
    const other = await seedCustomer();
    const outcomes = await Promise.allSettled([claimListing(o.buyer.id, o.listing.id, contact), claimListing(other.id, o.listing.id, contact)]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.pasaloTrade.count({ where: { listingId: o.listing.id, status: "RESERVED" } })).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId } })).status).toBe("CONFIRMED");
    await expect(claimListing(o.customerId, o.listing.id, contact)).rejects.toThrow(/own/i);
  });
  it("limits chat and wallet access to the exact buyer and seller, including admins", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    const stranger = await prisma.user.create({ data: { role: "ADMIN", email: "admin@pasalo.test" } });
    await postMessage(o.buyer.id, t.id, "Hello seller");
    expect((await tradeThread(o.customerId, t.id)).messages.some(m => m.body === "Hello seller" && m.sender === "BUYER")).toBe(true);
    expect((await tradeThread(o.buyer.id, t.id)).payment.accountNumber).toBe("+639171234567");
    await expect(tradeThread(stranger.id, t.id)).rejects.toThrow(/permission/i);
    await expect(postMessage(stranger.id, t.id, "spy")).rejects.toThrow(/permission/i);
    await expect(postMessage(o.buyer.id, t.id, "x".repeat(1001))).rejects.toThrow(/1000/i);
    for (let i = 0; i < 9; i++) await postMessage(o.buyer.id, t.id, `message ${i}`);
    await expect(postMessage(o.buyer.id, t.id, "spam")).rejects.toThrow(/minute/i);
  });
  it("buyer payment declaration never transfers; seller confirms wallet receipt", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    await expect(transferTrade(o.customerId, t.id)).rejects.toThrow(/payment/i);
    await markPaymentSent(o.buyer.id, t.id, "BUYER-SALE-REF");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId } })).userId).toBe(o.customerId);
    await expect(transferTrade(o.buyer.id, t.id)).rejects.toThrow(/seller|permission/i);
    const result = await transferTrade(o.customerId, t.id);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId }, include: { payment: true } });
    expect(b.userId).toBe(o.buyer.id);
    expect(b.reference).toBe(result.bookingReference);
    expect(b.reference).not.toBe(o.reference);
    expect(b.customerName).toBe(contact.customerName);
    expect(b.customerMobile).toBe("+639181234567");
    expect(b.priceCents).toBe(40000);
    expect(b.payment?.reference).toBe("ORIGINAL-PRIVATE");
    expect((await tradeThread(o.customerId, t.id)).bookingReference).toBeNull();
    expect((await tradeThread(o.buyer.id, t.id)).bookingReference).toBe(b.reference);
    const historyBefore = await prisma.bookingStatusHistory.count();
    expect(await transferTrade(o.customerId, t.id)).toEqual(result);
    expect(await prisma.bookingStatusHistory.count()).toBe(historyBefore);
    await expect(createListing(o.buyer.id, { ...o.input, priceCents: 20000 })).rejects.toThrow(/resold|transfer/i);
  });
  it("releases unpaid claims, but cannot reopen after payment is declared", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    await releaseTrade(o.buyer.id, t.id);
    const next = await claimListing(o.buyer.id, o.listing.id, contact);
    await markPaymentSent(o.buyer.id, next.id);
    await expect(releaseTrade(o.buyer.id, next.id)).rejects.toThrow(/payment/i);
    await expect(withdrawListing(o.customerId, o.listing.id)).rejects.toThrow(/payment/i);
    const future = Date.now() + 20 * 60000;
    vi.spyOn(Date, "now").mockReturnValue(future);
    expect((await tradeThread(o.buyer.id, next.id)).trade.status).toBe("PAYMENT_SENT");
    expect((await publicListing(o.listing.id, o.buyer.id)).canClaim).toBe(false);
  });
  it("expires stale unpaid claims without exposing their chat to another buyer", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    await prisma.pasaloTrade.update({ where: { id: t.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    const other = await seedCustomer();
    const next = await claimListing(other.id, o.listing.id, contact);
    expect(next.id).not.toBe(t.id);
    expect((await tradeThread(o.buyer.id, t.id)).trade.status).toBe("EXPIRED");
    await expect(tradeThread(other.id, t.id)).rejects.toThrow(/permission/i);
    await expect(markPaymentSent(o.buyer.id, t.id)).rejects.toThrow(/active|expired/i);
  });
  it("does not transfer changed or cancelled reservations", async () => {
    const o = await offer();
    const t = await claimListing(o.buyer.id, o.listing.id, contact);
    await markPaymentSent(o.buyer.id, t.id);
    await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "CANCELLED" } });
    await expect(transferTrade(o.customerId, t.id)).rejects.toThrow(/available|valid|active/i);
    expect((await tradeThread(o.buyer.id, t.id)).trade.status).toBe("VOIDED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId } })).userId).toBe(o.customerId);
  });
});
