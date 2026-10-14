import "server-only";
import type { Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { lockBooking } from "@/lib/booking/lock";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/booking/errors";
import { actualStart, CUTOFF_MS } from "./rules";

export type Tx = Prisma.TransactionClient;
export const listingInclude = {
  seller: { select: { name: true, isActive: true } },
  booking: { include: { venue: true, court: true, payment: true, checkout: true } },
  trades: { where: { status: { in: ["RESERVED", "PAYMENT_SENT"] } }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.PasaloListingInclude;
export type Listing = Prisma.PasaloListingGetPayload<{ include: typeof listingInclude }>;

export async function activeUser(userId: string, tx: Tx = prisma) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user?.isActive) throw new ForbiddenError("This account is unavailable.");
  return user;
}

export function bookingAvailable(l: Listing) {
  const b = l.booking;
  return b.userId === l.sellerId && b.status === "CONFIRMED" && b.backendType === "LOCAL" && b.source === "ONLINE" && b.currency === "PHP"
    && b.startsAt.getTime() === l.startsAt.getTime() && b.endsAt.getTime() === l.endsAt.getTime()
    && b.priceCents === l.originalPriceCents && b.venue.status === "APPROVED" && b.venue.isPublished && b.court.active && l.seller.isActive
    && ((b.payment?.amountCents ?? 0) >= b.priceCents || (b.checkout?.status === "PAID" && b.checkout.amountCents >= b.priceCents));
}

export async function systemMessage(tx: Tx, tradeId: string, body: string) {
  await tx.pasaloMessage.create({ data: { tradeId, body } });
}

/** Called with the booking lock held. Sold receipts remain immutable. */
export async function normalizeListing(tx: Tx, listing: Listing, now = Date.now()): Promise<Listing> {
  if (!["ACTIVE", "RESERVED"].includes(listing.status)) return listing;
  const active = listing.trades[0];
  const invalid = !bookingAvailable(listing);
  const started = actualStart(listing.startsAt) <= now;
  const closed = !active && actualStart(listing.startsAt) - now <= CUTOFF_MS;
  if (invalid || started || closed) {
    await tx.pasaloListing.update({ where: { id: listing.id }, data: { status: invalid ? "VOIDED" : "EXPIRED" } });
    if (active) {
      await tx.pasaloTrade.update({ where: { id: active.id }, data: { status: invalid ? "VOIDED" : "EXPIRED" } });
      await systemMessage(tx, active.id, "This reservation is no longer available for transfer. If you sent money, resolve the direct payment with the other player here. Pikol cannot automatically refund it.");
    }
  } else if (active?.status === "RESERVED" && active.expiresAt.getTime() <= now) {
    await tx.pasaloTrade.update({ where: { id: active.id }, data: { status: "EXPIRED" } });
    await tx.pasaloListing.update({ where: { id: listing.id }, data: { status: actualStart(listing.startsAt) - now <= CUTOFF_MS ? "EXPIRED" : "ACTIVE" } });
    await systemMessage(tx, active.id, "Your unpaid reservation expired. Do not send payment for this claim.");
  } else return listing;
  return tx.pasaloListing.findUniqueOrThrow({ where: { id: listing.id }, include: listingInclude });
}

export async function withListing<T>(id: string, fn: (tx: Tx, listing: Listing) => Promise<T>): Promise<T> {
  const key = await prisma.pasaloListing.findUnique({ where: { id }, select: { bookingId: true } });
  if (!key) throw new NotFoundError("Pasalo offer not found");
  return prisma.$transaction(async tx => {
    await lockBooking(tx, key.bookingId);
    const l = await tx.pasaloListing.findUniqueOrThrow({ where: { id }, include: listingInclude });
    return fn(tx, await normalizeListing(tx, l));
  });
}

export async function withTrade<T>(userId: string, id: string, fn: (tx: Tx, listing: Listing, trade: Prisma.PasaloTradeGetPayload<object>, role: "SELLER" | "BUYER") => Promise<T>): Promise<T> {
  const key = await prisma.pasaloTrade.findUnique({ where: { id }, select: { listingId: true, buyerId: true, listing: { select: { sellerId: true } } } });
  if (!key) throw new NotFoundError("Pasalo conversation not found");
  if (key.buyerId !== userId && key.listing.sellerId !== userId) throw new ForbiddenError("You don't have permission to open this conversation.");
  return withListing(key.listingId, async (tx, l) => {
    await activeUser(userId, tx);
    const trade = await tx.pasaloTrade.findUniqueOrThrow({ where: { id } });
    return fn(tx, l, trade, l.sellerId === userId ? "SELLER" : "BUYER");
  });
}

export function requireActiveTrade(status: string) {
  if (status !== "RESERVED" && status !== "PAYMENT_SENT") throw new ConflictError("This claim is no longer active.");
}
