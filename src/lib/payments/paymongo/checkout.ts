import "server-only";
import prisma from "@/lib/prisma";
import type { PaymentCheckout, Role } from "@/generated/prisma";
import {
  ConflictError,
  ForbiddenError,
  HoldExpiredError,
  NotFoundError,
} from "@/lib/booking/errors";
import { lockBooking } from "@/lib/booking/lock";
import {
  configurationError,
  ledgerReady,
  merchantByAlias,
  merchantForVenue,
} from "./config";
import {
  createCheckout,
  getCheckout,
  expireCheckout,
  ProviderError,
} from "./client";
import { paidFromSession } from "./webhook";
import { settlePayment } from "./settlement";

export function checkoutForBooking(bookingId: string) {
  return ledgerReady()
    ? prisma.paymentCheckout.findUnique({ where: { bookingId } })
    : Promise.resolve(null);
}
export function publicCheckoutStatus(checkout: PaymentCheckout | null) {
  if (!checkout) return null;
  return {
    status: checkout.status,
    testMode: checkout.mode === "test",
    amountCents: checkout.amountCents,
    paymentReference: checkout.status === "PAID" ? checkout.paymentId : null,
    paidAt: checkout.paidAt?.toISOString() ?? null,
  };
}
export async function startCheckout(
  bookingId: string,
  userId: string,
  role: Role,
) {
  if (!ledgerReady()) configurationError();
  const prepared = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, bookingId);
    const b = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { venue: true, payment: true },
    });
    if (!b) throw new NotFoundError("Booking not found");
    if (b.userId !== userId && role !== "ADMIN") throw new ForbiddenError();
    const existing = await tx.paymentCheckout.findUnique({
      where: { bookingId },
    });
    if (existing?.status === "PAID")
      return { next: `/bookings/${encodeURIComponent(b.reference)}` };
    if (
      b.status !== "PENDING_PAYMENT" ||
      b.payment ||
      b.backendType !== "LOCAL" ||
      b.source !== "ONLINE" ||
      b.currency !== "PHP"
    )
      throw new ConflictError(
        "This booking is not awaiting an online payment.",
      );
    if (!b.holdExpiresAt || b.holdExpiresAt <= new Date())
      throw new HoldExpiredError();
    const merchant =
      merchantForVenue(b.venueId, b.venue.ownerId) ?? configurationError();
    if (b.venue.status !== "APPROVED" || !b.venue.isPublished)
      configurationError();
    if (existing) {
      if (
        existing.status === "PENDING" &&
        existing.checkoutUrl &&
        existing.merchantAlias === merchant.alias &&
        existing.mode === merchant.mode &&
        existing.recipientOwnerId === b.venue.ownerId &&
        existing.amountCents === b.priceCents
      )
        return { checkoutUrl: existing.checkoutUrl };
      throw new ConflictError(
        "A payment has already been started. Check its status before trying again.",
      );
    }
    const attempt = await tx.paymentCheckout.create({
      data: {
        bookingId,
        merchantAlias: merchant.alias,
        mode: merchant.mode,
        recipientOwnerId: merchant.ownerId,
        amountCents: b.priceCents,
        currency: "PHP",
        holdExpiresAt: b.holdExpiresAt,
      },
    });
    return {
      attempt,
      merchant,
      reference: b.reference,
      venueName: b.venue.name,
    };
  });
  if (!prepared.attempt)
    return { checkoutUrl: prepared.checkoutUrl, next: prepared.next };
  let created;
  try {
    created = await createCheckout(prepared.merchant, {
      attemptId: prepared.attempt.id,
      reference: prepared.reference,
      amountCents: prepared.attempt.amountCents,
      venueName: prepared.venueName,
    });
  } catch (error) {
    await prisma.paymentCheckout.updateMany({
      where: { id: prepared.attempt.id, status: "CREATING" },
      data: {
        status:
          error instanceof ProviderError && error.definitive
            ? "FAILED"
            : "REVIEW",
        reviewReason: "create_response_unconfirmed",
      },
    });
    throw error;
  }
  const { latest, payable } = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, bookingId);
    await tx.paymentCheckout.updateMany({
      where: { id: prepared.attempt.id, status: "CREATING" },
      data: { ...created, status: "PENDING" },
    });
    // Retain the provider ID even when a recovery worker already quarantined creation.
    await tx.paymentCheckout.updateMany({
      where: { id: prepared.attempt.id, status: "REVIEW", sessionId: null },
      data: created,
    });
    const latest = await tx.paymentCheckout.findUniqueOrThrow({
      where: { id: prepared.attempt.id },
    });
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    return {
      latest,
      payable:
        booking.status === "PENDING_PAYMENT" &&
        !!booking.holdExpiresAt &&
        booking.holdExpiresAt > new Date() &&
        latest.holdExpiresAt > new Date(),
    };
  });
  if (latest.status === "PAID")
    return { next: `/bookings/${encodeURIComponent(prepared.reference)}` };
  if (!payable) {
    // Cancellation or hold expiry can happen during the provider request. Never hand out that URL.
    let expired = false;
    try {
      const result = await expireCheckout(prepared.merchant, created.sessionId);
      expired =
        result.id === created.sessionId &&
        result.attributes.status === "expired";
    } catch {
      // A payment may already be in progress; keep the attempt for verified reconciliation.
    }
    await prisma.paymentCheckout.updateMany({
      where: { id: prepared.attempt.id, status: "PENDING" },
      data: {
        status: expired ? "EXPIRED" : "REVIEW",
        reviewReason: expired ? null : "booking_released_during_creation",
      },
    });
    throw new ConflictError(
      "This reservation was released. Check payment status before paying again.",
    );
  }
  if (latest.status !== "PENDING")
    throw new ConflictError("Your payment needs a status check.");
  return { checkoutUrl: created.checkoutUrl };
}
/** Private caller must authorize the booking first. Return URLs never settle payment. */
export async function reconcileCheckout(bookingId: string) {
  const checkout = await checkoutForBooking(bookingId);
  if (!checkout || ["PAID", "FAILED", "EXPIRED"].includes(checkout.status))
    return publicCheckoutStatus(checkout);
  // Lost POST responses cannot be retried safely; the webhook or merchant dashboard recovers them.
  if (!checkout.sessionId) return publicCheckoutStatus(checkout);
  // A bounded polling UI and this server throttle avoid overwhelming the provider.
  if (
    checkout.lastCheckedAt &&
    Date.now() - checkout.lastCheckedAt.getTime() < 4000
  )
    return publicCheckoutStatus(checkout);
  const claimed = await prisma.paymentCheckout.updateMany({
    where: {
      id: checkout.id,
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(Date.now() - 4000) } },
      ],
    },
    data: { lastCheckedAt: new Date() },
  });
  if (!claimed.count)
    return publicCheckoutStatus(await checkoutForBooking(bookingId));
  const merchant = merchantByAlias(checkout.merchantAlias, checkout.mode);
  const session = await getCheckout(merchant, checkout.sessionId);
  if (session.id !== checkout.sessionId) throw new ProviderError();
  const paid = paidFromSession(session, checkout.mode === "live");
  if (paid) await settlePayment(merchant, paid);
  else if (
    Array.isArray(session.attributes.payments) &&
    session.attributes.payments.some(
      (payment) => payment?.attributes?.status === "paid",
    )
  ) {
    // Money reported without a verifiable receipt must never unlock another payment path.
    await prisma.paymentCheckout.updateMany({
      where: { id: checkout.id, status: { in: ["CREATING", "PENDING"] } },
      data: {
        status: "REVIEW",
        reviewReason: "provider_paid_response_unverified",
      },
    });
  } else if (session.attributes.status === "expired")
    await prisma.paymentCheckout.updateMany({
      where: { id: checkout.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
  else if (checkout.holdExpiresAt <= new Date()) {
    // Provider expiration can race a payment; only a confirmed expired response permits manual fallback.
    const expired = await expireCheckout(merchant, checkout.sessionId);
    if (
      expired.id === checkout.sessionId &&
      expired.attributes.status === "expired"
    ) {
      await prisma.paymentCheckout.updateMany({
        where: { id: checkout.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    }
  }
  return publicCheckoutStatus(await checkoutForBooking(bookingId));
}
