import "server-only";
import prisma from "@/lib/prisma";
import { lockBooking } from "@/lib/booking/lock";
import { notificationService } from "@/lib/notifications/service";
import { ledgerReady, type Merchant } from "./config";
import type { PaidEvent } from "./webhook";

/** Caller must verify the raw webhook signature or fetch this receipt from PayMongo. */
export async function settlePayment(
  merchant: Merchant,
  event: PaidEvent,
  defer?: (notification: () => Promise<void>) => void,
) {
  if (!ledgerReady()) throw new Error("Payment ledger is not ready");
  const initial = await prisma.paymentCheckout.findUnique({
    where: { id: event.attemptId },
    select: { bookingId: true },
  });
  const result = await prisma.$transaction(async (tx) => {
    if (initial) await lockBooking(tx, initial.bookingId);
    const checkout = initial
      ? await tx.paymentCheckout.findUnique({
          where: { id: event.attemptId },
          include: { booking: { include: { venue: true, payment: true } } },
        })
      : null;
    const linked =
      checkout &&
      checkout.merchantAlias === merchant.alias &&
      checkout.mode === merchant.mode;
    const receipt = await tx.paymentWebhookReceipt.createMany({
      data: [
        {
          merchantAlias: merchant.alias,
          mode: merchant.mode,
          eventId: event.eventId,
          sessionId: event.sessionId,
          paymentId: event.paymentId,
          checkoutId: linked ? checkout.id : null,
          amountCents: event.amountCents,
          currency: event.currency,
          channel: event.channel,
          outcome: "UNMATCHED",
        },
      ],
      skipDuplicates: true,
    });
    if (!receipt.count) return { outcome: "DUPLICATE" };
    const receiptWhere = {
      merchantAlias_mode_eventId: {
        merchantAlias: merchant.alias,
        mode: merchant.mode,
        eventId: event.eventId,
      },
    };
    if (!linked) return { outcome: "UNMATCHED" };
    if (checkout.status === "PAID") {
      const outcome =
        checkout.paymentId === event.paymentId ? "DUPLICATE" : "REVIEW";
      await tx.paymentWebhookReceipt.update({
        where: receiptWhere,
        data: { outcome },
      });
      if (outcome === "REVIEW")
        await tx.paymentCheckout.update({
          where: { id: checkout.id },
          data: { reviewReason: "additional_payment" },
        });
      return { outcome };
    }
    const b = checkout.booking,
      now = new Date();
    const method = { GCASH: "gcash", MAYA: "paymaya", QRPH: "qrph" } as const;
    const reason =
      event.livemode !== (checkout.mode === "live")
        ? "mode_mismatch"
        : event.reference !== b.reference
          ? "reference_mismatch"
          : checkout.sessionId && checkout.sessionId !== event.sessionId
            ? "session_mismatch"
            : event.amountCents !== checkout.amountCents ||
                b.priceCents !== checkout.amountCents
              ? "amount_mismatch"
              : event.currency !== "PHP" || b.currency !== "PHP"
                ? "currency_mismatch"
                : merchant.ownerId !== checkout.recipientOwnerId ||
                    b.venue.ownerId !== checkout.recipientOwnerId ||
                    !merchant.venueIds.includes(b.venueId)
                  ? "recipient_changed"
                  : !merchant.methods.includes(method[event.channel])
                    ? "method_not_enabled"
                    : b.status !== "PENDING_PAYMENT" ||
                        b.payment ||
                        b.source !== "ONLINE" ||
                        b.backendType !== "LOCAL"
                      ? "booking_not_payable"
                      : !b.holdExpiresAt ||
                          b.holdExpiresAt <= now ||
                          checkout.holdExpiresAt <= now
                        ? "late_payment"
                        : null;
    if (reason) {
      await tx.paymentCheckout.update({
        where: { id: checkout.id },
        data: { status: "REVIEW", reviewReason: reason },
      });
      await tx.paymentWebhookReceipt.update({
        where: receiptWhere,
        data: { outcome: "REVIEW" },
      });
      return { outcome: "REVIEW" };
    }
    // The booking row remains locked through the receipt and both status transitions.
    await tx.paymentSubmission.create({
      data: {
        bookingId: b.id,
        channel: event.channel,
        reference: event.paymentId,
        proofKey: null,
        amountCents: checkout.amountCents,
      },
    });
    await tx.booking.update({
      where: { id: b.id },
      data: { status: "PENDING_CONFIRMATION", holdExpiresAt: null },
    });
    await tx.bookingStatusHistory.createMany({
      data: [
        {
          bookingId: b.id,
          fromStatus: "PENDING_PAYMENT",
          toStatus: "PAYMENT_SUBMITTED",
          actor: "SYSTEM",
          note: "Payment verified by PayMongo",
        },
        {
          bookingId: b.id,
          fromStatus: "PAYMENT_SUBMITTED",
          toStatus: "PENDING_CONFIRMATION",
          actor: "SYSTEM",
          note: "Awaiting venue confirmation",
        },
      ],
    });
    await tx.paymentCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "PAID",
        reviewReason: null,
        sessionId: event.sessionId,
        paymentId: event.paymentId,
        paidAt: now,
      },
    });
    await tx.paymentWebhookReceipt.update({
      where: receiptWhere,
      data: { outcome: "APPLIED" },
    });
    return { outcome: "APPLIED", bookingId: b.id };
  });
  if (result.bookingId) {
    const notify = async () => {
      try {
        await notificationService.onPaymentSubmitted(result.bookingId!);
      } catch {
        console.error("[paymongo] payment notification delivery failed");
      }
    };
    if (defer) defer(notify);
    else await notify();
  }
  if (["REVIEW", "UNMATCHED"].includes(result.outcome))
    console.error("[paymongo] reconciliation required", {
      outcome: result.outcome,
      eventId: event.eventId,
      merchant: merchant.alias,
    });
  return result.outcome;
}
