import "server-only";
import type { Booking, Prisma } from "@/generated/prisma";
import type { Actor } from "@/lib/booking/backend";
import { ConflictError, ForbiddenError } from "@/lib/booking/errors";
import { systemMessage } from "./core";

/** Revalidate the actor after locking: a preflight check may precede a transfer. */
export async function guardPasaloBookingMutation(tx: Prisma.TransactionClient, b: Booking, actor: Actor, changesReservation: boolean) {
  const l = await tx.pasaloListing.findUnique({ where: { bookingId: b.id } });
  if (!l) return;
  let manager = actor.type === "SYSTEM" || actor.type === "ADMIN";
  if (!manager && actor.id && (actor.type === "OWNER" || actor.type === "STAFF")) {
    const venue = await tx.venue.findUnique({ where: { id: b.venueId }, select: { ownerId: true } });
    manager = venue?.ownerId === actor.id || !!await tx.venueStaff.findUnique({ where: { venueId_userId: { venueId: b.venueId, userId: actor.id } } });
  }
  if (!manager && (!actor.id || b.userId !== actor.id)) throw new ForbiddenError("You no longer have permission as this booking's holder.");
  if (!changesReservation || !["ACTIVE", "RESERVED"].includes(l.status)) return;
  if (!manager) throw new ConflictError("Withdraw your Pasalo offer before cancelling or rescheduling this booking.");
  const trades = await tx.pasaloTrade.findMany({ where: { listingId: l.id, status: { in: ["RESERVED", "PAYMENT_SENT"] } } });
  await tx.pasaloListing.update({ where: { id: l.id }, data: { status: "VOIDED" } });
  for (const t of trades) {
    await tx.pasaloTrade.update({ where: { id: t.id }, data: { status: "VOIDED" } });
    await systemMessage(tx, t.id, "The venue changed this reservation. This Pasalo offer is no longer valid. If money was sent, resolve the direct payment with the other player here; Pikol cannot automatically refund it.");
    await tx.notification.createMany({ data: [l.sellerId, t.buyerId].map(userId => ({ userId, type: "PASALO_VOIDED", title: "Your Pasalo reservation changed", link: `/pasalo/trades/${t.id}` })) });
  }
}
