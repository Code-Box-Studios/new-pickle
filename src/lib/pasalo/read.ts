import "server-only";
import type { PasaloListing, PasaloTrade, Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { ForbiddenError, ValidationError } from "@/lib/booking/errors";
import { activeUser, bookingAvailable, listingInclude, withListing, withTrade } from "./core";
import { actualStart, CUTOFF_MS } from "./rules";
import type { PasaloListingView, PasaloTradeView, PasaloDetailView, PasaloMineView, PasaloThreadView } from "./types";

export function listingView(l: PasaloListing & { seller: { name: string | null } }): PasaloListingView {
  return { id: l.id, venueName: l.venueName, venueSlug: l.venueSlug, courtName: l.courtName, city: l.city,
    startsAt: l.startsAt.toISOString(), endsAt: l.endsAt.toISOString(), originalPriceCents: l.originalPriceCents, priceCents: l.priceCents,
    note: l.note, status: l.status, sellerName: l.seller.name?.trim().split(/\s+/)[0] || "Player" };
}

export function tradeView(t: PasaloTrade): PasaloTradeView {
  return { id: t.id, status: t.status, priceCents: t.priceCents, customerName: t.customerName, expiresAt: t.expiresAt.toISOString(),
    paymentSentAt: t.paymentSentAt?.toISOString() ?? null, transferredAt: t.transferredAt?.toISOString() ?? null, paymentReference: t.paymentReference };
}

function tradeListingView(t: PasaloTrade, l: PasaloListingView): PasaloListingView {
  const status = { RESERVED: "RESERVED", PAYMENT_SENT: "RESERVED", TRANSFERRED: "SOLD", RELEASED: "WITHDRAWN", EXPIRED: "EXPIRED", VOIDED: "VOIDED" } as const;
  return { ...(t.listingSnapshot as unknown as PasaloListingView), id: l.id, status: status[t.status] };
}

export async function marketListings(city?: string): Promise<PasaloListingView[]> {
  if (city && city.length > 100) throw new ValidationError("City is too long.");
  const now = Date.now();
  const listings = await prisma.pasaloListing.findMany({
    where: { status: { in: ["ACTIVE", "RESERVED"] }, startsAt: { gt: new Date(now + 8 * 3600000 + CUTOFF_MS) }, ...(city ? { city } : {}),
      seller: { isActive: true }, booking: { status: "CONFIRMED", venue: { status: "APPROVED", isPublished: true }, court: { active: true } } },
    include: listingInclude, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 100,
  });
  return listings.filter(l => {
    const t = l.trades[0];
    return (!t || (t.status === "RESERVED" && t.expiresAt.getTime() <= now)) && bookingAvailable(l);
  }).map(l => listingView({ ...l, status: "ACTIVE" }));
}

export async function publicListing(id: string, userId?: string | null): Promise<PasaloDetailView> {
  return withListing(id, async (tx, l) => {
    if (userId) await activeUser(userId, tx);
    const isSeller = l.sellerId === userId;
    const trade = userId ? await tx.pasaloTrade.findFirst({ where: { listingId: id, ...(isSeller ? {} : { buyerId: userId }), status: { in: ["RESERVED", "PAYMENT_SENT", "TRANSFERRED"] } }, orderBy: { createdAt: "desc" } }) : null;
    return { listing: listingView(l), isSeller, myTradeId: trade?.id ?? null, canClaim: !isSeller && l.status === "ACTIVE" && actualStart(l.startsAt) - Date.now() > CUTOFF_MS };
  });
}

export async function myPasalo(userId: string): Promise<PasaloMineView> {
  await activeUser(userId);
  const selling = await prisma.pasaloListing.findMany({ where: { sellerId: userId }, include: { seller: { select: { name: true } }, trades: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21 } }, orderBy: { createdAt: "desc" }, take: 100 });
  const buying = await prisma.pasaloTrade.findMany({ where: { buyerId: userId }, include: { listing: { include: { seller: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return { selling: selling.map(l => ({ listing: listingView(l), tradeId: l.trades[0]?.id ?? null, conversations: l.trades.slice(0, 20).map(tradeView), hasOlderConversations: l.trades.length > 20 })), buying: buying.map(t => ({ listing: tradeListingView(t, listingView(t.listing)), trade: tradeView(t) })) };
}

export async function sellerConversations(userId: string, listingId: string, before: string) {
  await activeUser(userId);
  const l = await prisma.pasaloListing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
  if (!l || l.sellerId !== userId) throw new ForbiddenError("Only this offer's seller can list its conversations.");
  const cursor = await prisma.pasaloTrade.findFirst({ where: { id: before, listingId } });
  if (!cursor) throw new ValidationError("Invalid conversation cursor.");
  const rows = await prisma.pasaloTrade.findMany({ where: { listingId, OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21 });
  return { conversations: rows.slice(0, 20).map(tradeView), hasOlder: rows.length > 20 };
}

export async function tradeThread(userId: string, tradeId: string, before?: string): Promise<PasaloThreadView> {
  return withTrade(userId, tradeId, async (tx, l, t, role) => {
    let older: Prisma.PasaloMessageWhereInput = {};
    if (before) {
      const cursor = await tx.pasaloMessage.findFirst({ where: { id: before, tradeId } });
      if (!cursor) throw new ValidationError("Invalid conversation cursor.");
      older = { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] };
    }
    const rows = await tx.pasaloMessage.findMany({ where: { tradeId, ...older }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
    return { listing: tradeListingView(t, listingView(l)), trade: tradeView(t), role,
      payment: { channel: t.paymentChannel as "GCASH" | "MAYA", accountName: t.paymentAccountName, accountNumber: t.paymentAccountNumber },
      messages: rows.slice(0, 50).reverse().map(m => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), sender: m.senderId === null ? "SYSTEM" : m.senderId === l.sellerId ? "SELLER" : "BUYER", mine: m.senderId === userId })),
      hasOlder: rows.length > 50, bookingReference: role === "BUYER" && t.status === "TRANSFERRED" && l.booking.userId === userId ? l.booking.reference : null,
    };
  });
}
