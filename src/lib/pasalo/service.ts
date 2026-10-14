import "server-only";
import prisma from "@/lib/prisma";
import { lockBooking } from "@/lib/booking/lock";
import { newReference } from "@/lib/booking/reference";
import { normalizePhone } from "@/lib/auth/phone-code";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { activeUser, bookingAvailable, listingInclude, normalizeListing, systemMessage, withListing, withTrade, requireActiveTrade } from "./core";
import { actualStart, assertListingWindow, assertOfferPrice, boundedText, CLAIM_MS } from "./rules";
import type { ClaimInput, CreateListingInput } from "./types";
import { listingView } from "./read";
import { revokePlayerInvitationsOnTransfer } from "@/lib/players/transfer";

export async function createListing(userId: string, input: CreateListingInput) {
  const bookingId = boundedText(input.bookingId, "Booking", 100);
  const name = boundedText(input.paymentAccountName, "Wallet account name", 100);
  const phone = normalizePhone(boundedText(input.paymentAccountNumber, "Wallet mobile", 40));
  const note = boundedText(input.note, "Note", 500, false);
  if (input.paymentChannel !== "GCASH" && input.paymentChannel !== "MAYA") throw new ValidationError("Choose GCash or Maya.");
  return prisma.$transaction(async tx => {
    await lockBooking(tx, bookingId);
    await activeUser(userId, tx);
    const b = await tx.booking.findUnique({ where: { id: bookingId }, include: { venue: true, court: true, payment: true, checkout: true, pasaloListing: true } });
    if (!b) throw new NotFoundError("Booking not found");
    if (b.userId !== userId) throw new ForbiddenError("You can only offer your own booking.");
    if (b.pasaloListing?.status === "SOLD") throw new ConflictError("This booking has already been resold once.");
    if (b.backendType !== "LOCAL" || b.source !== "ONLINE" || b.currency !== "PHP") throw new ConflictError("Transfers are available for local online PHP bookings only.");
    if (b.status !== "CONFIRMED") throw new ConflictError("The booking must be confirmed.");
    if (!b.venue.isPublished || b.venue.status !== "APPROVED" || !b.court.active) throw new ConflictError("This venue or court is no longer available.");
    if (!((b.payment?.amountCents ?? 0) >= b.priceCents || (b.checkout?.status === "PAID" && b.checkout.amountCents >= b.priceCents))) throw new ConflictError("The original booking must be fully paid.");
    assertListingWindow(b.startsAt);
    assertOfferPrice(input.priceCents, b.priceCents);
    if (b.pasaloListing) {
      const l = await normalizeListing(tx, await tx.pasaloListing.findUniqueOrThrow({ where: { id: b.pasaloListing.id }, include: listingInclude }));
      if (l.status === "ACTIVE" || l.status === "RESERVED") throw new ConflictError("Withdraw the existing offer before changing it.");
      if (l.sellerId !== userId) throw new ForbiddenError("This transfer belongs to another seller.");
    }
    const data = { sellerId: userId, originalReference: b.reference, venueName: b.venue.name, venueSlug: b.venue.slug, courtName: b.court.name, city: b.venue.city,
      startsAt: b.startsAt, endsAt: b.endsAt, originalPriceCents: b.priceCents, priceCents: input.priceCents, note: note || null,
      paymentChannel: input.paymentChannel, paymentAccountName: name, paymentAccountNumber: phone, status: "ACTIVE" as const };
    const l = await tx.pasaloListing.upsert({ where: { bookingId }, create: { bookingId, ...data }, update: data });
    return { id: l.id };
  });
}

export async function claimListing(userId: string, listingId: string, input: ClaimInput) {
  const customerName = boundedText(input.customerName, "Player name", 100);
  const customerMobile = normalizePhone(boundedText(input.customerMobile, "Mobile", 40));
  return withListing(listingId, async (tx, l) => {
    const buyer = await activeUser(userId, tx);
    if (l.sellerId === userId) throw new ForbiddenError("You cannot claim your own booking.");
    const own = l.trades.find(t => t.buyerId === userId);
    if (own) return { id: own.id };
    if (l.status !== "ACTIVE" || !bookingAvailable(l)) throw new ConflictError("This offer is no longer available.");
    assertListingWindow(l.startsAt);
    // Persistent per-player serialization prevents claim spam across app instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pasalo-buyer:${userId}`}))`;
    const recent = await tx.pasaloTrade.count({ where: { buyerId: userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (recent >= 10) throw new AppError("Too many claims. Try again in an hour.", 429, "rate_limited");
    const t = await tx.pasaloTrade.create({ data: { listingId: l.id, buyerId: userId, priceCents: l.priceCents, customerName, customerMobile, customerEmail: buyer.email,
      listingSnapshot: { ...listingView(l) }, paymentChannel: l.paymentChannel, paymentAccountName: l.paymentAccountName, paymentAccountNumber: l.paymentAccountNumber,
      expiresAt: new Date(Math.min(Date.now() + CLAIM_MS, actualStart(l.startsAt))) } });
    await tx.pasaloListing.update({ where: { id: l.id }, data: { status: "RESERVED" } });
    await systemMessage(tx, t.id, "Offer reserved for ten minutes. Discuss payment here before sending money. The seller must check their wallet and confirm receipt to transfer the booking. Pikol cannot automatically verify or refund direct payments.");
    await tx.notification.create({ data: { userId: l.sellerId, type: "PASALO_CLAIMED", title: "A player reserved your Pasalo offer", body: `${customerName} wants your booking at ${l.venueName}.`, link: `/pasalo/trades/${t.id}` } });
    return { id: t.id };
  });
}

export async function markPaymentSent(userId: string, tradeId: string, reference?: string) {
  const ref = boundedText(reference, "Payment reference", 100, false);
  return withTrade(userId, tradeId, async (tx, l, t, role) => {
    if (role !== "BUYER") throw new ForbiddenError("Only the buyer can declare payment sent.");
    requireActiveTrade(t.status);
    if (t.status === "PAYMENT_SENT") return;
    await tx.pasaloTrade.update({ where: { id: t.id }, data: { status: "PAYMENT_SENT", paymentSentAt: new Date(Date.now()), paymentReference: ref || null } });
    await systemMessage(tx, t.id, "Buyer says payment was sent. This is not verification. Seller: check your wallet balance and transaction before confirming receipt.");
    await tx.notification.create({ data: { userId: l.sellerId, type: "PASALO_PAYMENT_SENT", title: "Check your wallet for Pasalo payment", link: `/pasalo/trades/${t.id}` } });
  });
}

export async function transferTrade(userId: string, tradeId: string) {
  return withTrade(userId, tradeId, async (tx, l, t, role) => {
    if (role !== "SELLER") throw new ForbiddenError("Only the seller can confirm wallet receipt.");
    if (t.status === "TRANSFERRED") return { bookingReference: l.booking.reference };
    requireActiveTrade(t.status);
    if (t.status !== "PAYMENT_SENT") throw new ConflictError("Wait for the buyer to declare payment sent.");
    if (!bookingAvailable(l)) throw new ConflictError("This reservation is no longer valid for transfer.");
    await activeUser(t.buyerId, tx);
    const reference = newReference();
    const now = new Date(Date.now());
    await revokePlayerInvitationsOnTransfer(tx, l.bookingId);
    await tx.booking.update({ where: { id: l.bookingId }, data: { userId: t.buyerId, reference, customerName: t.customerName, customerMobile: t.customerMobile, customerEmail: t.customerEmail, note: null } });
    await tx.pasaloTrade.update({ where: { id: t.id }, data: { status: "TRANSFERRED", transferredAt: now } });
    await tx.pasaloListing.update({ where: { id: l.id }, data: { status: "SOLD", soldAt: now } });
    await tx.bookingStatusHistory.create({ data: { bookingId: l.bookingId, fromStatus: "CONFIRMED", toStatus: "CONFIRMED", actor: "CUSTOMER", actorId: userId, note: "Booking transferred through Pasalo after seller confirmed direct-payment receipt." } });
    await systemMessage(tx, t.id, "Seller confirmed wallet receipt. Booking transferred. The buyer has a fresh booking reference; the venue's original payment and court time are unchanged.");
    await tx.notification.createMany({ data: [
      { userId: t.buyerId, type: "PASALO_TRANSFERRED", title: "Your Pasalo booking is ready", link: `/bookings/${reference}` },
      { userId: l.sellerId, type: "PASALO_SOLD", title: "Your booking has been transferred", link: `/pasalo/trades/${t.id}` },
    ] });
    // The API route sends the fresh reference only to the buyer's private thread.
    return { bookingReference: reference };
  });
}

export async function releaseTrade(userId: string, tradeId: string) {
  return withTrade(userId, tradeId, async (tx, l, t, role) => {
    if (role !== "BUYER") throw new ForbiddenError("Only the buyer can release an unpaid claim.");
    if (t.status === "RELEASED") return;
    if (t.status === "PAYMENT_SENT") throw new ConflictError("Payment was declared. Resolve the direct payment in this conversation.");
    requireActiveTrade(t.status);
    await tx.pasaloTrade.update({ where: { id: t.id }, data: { status: "RELEASED" } });
    await tx.pasaloListing.update({ where: { id: l.id }, data: { status: "ACTIVE" } });
    await systemMessage(tx, t.id, "Buyer released this claim without sending payment. Do not send money for this claim.");
  });
}

export async function withdrawListing(userId: string, listingId: string) {
  return withListing(listingId, async (tx, l) => {
    await activeUser(userId, tx);
    if (l.sellerId !== userId) throw new ForbiddenError("Only the seller can withdraw this offer.");
    if (l.status === "WITHDRAWN") return;
    if (l.status === "SOLD") throw new ConflictError("This booking has already been transferred.");
    if (l.trades.some(t => t.status === "PAYMENT_SENT")) throw new ConflictError("Payment was declared. Resolve it in your conversation before taking further action.");
    for (const t of l.trades) {
      await tx.pasaloTrade.update({ where: { id: t.id }, data: { status: "VOIDED" } });
      await systemMessage(tx, t.id, "Seller withdrew this offer. Do not send payment.");
    }
    await tx.pasaloListing.update({ where: { id: l.id }, data: { status: "WITHDRAWN" } });
  });
}

export async function postMessage(userId: string, tradeId: string, body: unknown) {
  const text = boundedText(body, "Message", 1000);
  return withTrade(userId, tradeId, async (tx, _l, t) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pasalo-chat:${userId}`}))`;
    const count = await tx.pasaloMessage.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 60000) } } });
    if (count >= 10) throw new AppError("Send at most ten messages per minute.", 429, "rate_limited");
    await tx.pasaloMessage.create({ data: { tradeId: t.id, senderId: userId, body: text } });
  });
}
