import { Prisma, type Booking, type BookingStatus } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { lockBooking } from "./lock";
import { assertNoActiveCheckout } from "@/lib/payments/paymongo/guard";
import { isExclusionViolation, withBookingRetry } from "@/lib/db/pg-errors";
import {
  ConflictError,
  HoldExpiredError,
  NotFoundError,
  SlotTakenError,
} from "./errors";
import { assertTransition, HOLD_PHASE, isOccupying, OCCUPYING } from "./status";
import { newReference } from "./reference";
import { notificationService } from "@/lib/notifications/service";
import type {
  Actor,
  BookingBackend,
  CustomerDetails,
  HeldBooking,
  HoldInput,
  OccupiedRange,
  PaymentInput,
  WalkInInput,
} from "./backend";

type Tx = Prisma.TransactionClient;

function holdMinutes(): number {
  const n = Number(process.env.HOLD_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function toHeld(
  b: Pick<Booking, "id" | "reference" | "status" | "holdExpiresAt">,
): HeldBooking {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    holdExpiresAt: b.holdExpiresAt,
  };
}

function isExpiredHold(
  b: Pick<Booking, "status" | "holdExpiresAt">,
  now = new Date(),
): boolean {
  return (
    HOLD_PHASE.includes(b.status) && !!b.holdExpiresAt && b.holdExpiresAt < now
  );
}

/** Flip a court's stale holds to EXPIRED inside a transaction so their slots free up. */
async function expireStaleForCourt(
  tx: Tx,
  courtId: string,
  now: Date,
): Promise<void> {
  const stale = await tx.booking.findMany({
    where: { courtId, status: { in: HOLD_PHASE }, holdExpiresAt: { lt: now } },
    select: { id: true, status: true },
  });
  for (const b of stale) {
    const changed = await tx.booking.updateMany({
      where: {
        id: b.id,
        status: { in: HOLD_PHASE },
        holdExpiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });
    if (!changed.count) continue;
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: b.id,
        fromStatus: b.status,
        toStatus: "EXPIRED",
        actor: "SYSTEM",
        note: "Hold expired",
      },
    });
  }
}

/** Fire a notification best-effort: never let a delivery failure break a booking action. */
async function safeNotify(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

export class LocalBookingBackend implements BookingBackend {
  async createHold(input: HoldInput): Promise<HeldBooking> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + holdMinutes() * 60_000);
    const actorKind = input.source === "WALK_IN" ? "OWNER" : "CUSTOMER";

    const result = await withBookingRetry(async () => {
      try {
        return await prisma.$transaction(async (tx) => {
          if (input.idempotencyKey) {
            const existing = await tx.booking.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
            });
            if (existing) return toHeld(existing);
          }

          await expireStaleForCourt(tx, input.courtId, now);

          const booking = await tx.booking.create({
            data: {
              reference: newReference(),
              venueId: input.venueId,
              courtId: input.courtId,
              userId: input.userId ?? null,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              status: "HELD",
              holdExpiresAt: expiresAt,
              priceCents: input.priceCents,
              source: input.source ?? "ONLINE",
              idempotencyKey: input.idempotencyKey ?? null,
              customerName: input.customer.name ?? null,
              customerMobile: input.customer.mobile ?? null,
              customerEmail: input.customer.email ?? null,
            },
          });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              toStatus: "HELD",
              actor: actorKind,
              actorId: input.userId ?? null,
              note: "Hold created",
            },
          });
          return toHeld(booking);
        });
      } catch (e) {
        if (isExclusionViolation(e)) throw new SlotTakenError();
        throw e;
      }
    });
    if ((input.source ?? "ONLINE") !== "WALK_IN") {
      await safeNotify(() => notificationService.onBookingCreated(result.id));
    }
    return result;
  }

  async createWalkIn(input: WalkInInput): Promise<HeldBooking> {
    const now = new Date();
    return withBookingRetry(async () => {
      try {
        return await prisma.$transaction(async (tx) => {
          if (input.idempotencyKey) {
            const existing = await tx.booking.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
            });
            if (existing) return toHeld(existing);
          }

          await expireStaleForCourt(tx, input.courtId, now);

          // Owner-created booking: confirmed on creation, no payment workflow.
          const booking = await tx.booking.create({
            data: {
              reference: newReference(),
              venueId: input.venueId,
              courtId: input.courtId,
              userId: input.userId ?? null,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              status: "CONFIRMED",
              holdExpiresAt: null,
              priceCents: input.priceCents,
              source: "WALK_IN",
              idempotencyKey: input.idempotencyKey ?? null,
              customerName: input.customer.name ?? null,
              customerMobile: input.customer.mobile ?? null,
              customerEmail: input.customer.email ?? null,
              note: input.note ?? null,
            },
          });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              toStatus: "CONFIRMED",
              actor: "OWNER",
              actorId: input.userId ?? null,
              note: "Walk-in booking created",
            },
          });
          return toHeld(booking);
        });
      } catch (e) {
        if (isExclusionViolation(e)) throw new SlotTakenError();
        throw e;
      }
    });
  }

  async reschedule(
    bookingId: string,
    startsAt: Date,
    endsAt: Date,
    act: Actor,
  ): Promise<void> {
    await withBookingRetry(async () => {
      try {
        await prisma.$transaction(async (tx) => {
          await lockBooking(tx, bookingId);
          await assertNoActiveCheckout(bookingId, tx);
          const b = await tx.booking.findUnique({ where: { id: bookingId } });
          if (!b) throw new NotFoundError("Booking not found");
          if (!isOccupying(b.status)) {
            throw new ConflictError(
              "This booking can no longer be rescheduled",
            );
          }
          await tx.booking.update({
            where: { id: bookingId },
            data: { startsAt, endsAt },
          });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId,
              fromStatus: b.status,
              toStatus: b.status,
              actor: act.type,
              actorId: act.id ?? null,
              note: "Rescheduled",
            },
          });
        });
      } catch (e) {
        if (isExclusionViolation(e)) throw new SlotTakenError();
        throw e;
      }
    });
  }

  async submitDetails(
    bookingId: string,
    customer: CustomerDetails,
    actor: Actor,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockBooking(tx, bookingId);
      const b = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!b) throw new NotFoundError("Booking not found");
      if (isExpiredHold(b)) throw new HoldExpiredError();

      const data = {
        customerName: customer.name ?? b.customerName,
        customerMobile: customer.mobile ?? b.customerMobile,
        customerEmail: customer.email ?? b.customerEmail,
      };

      if (b.status === "HELD") {
        assertTransition(b.status, "PENDING_PAYMENT");
        await tx.booking.update({
          where: { id: bookingId },
          data: { ...data, status: "PENDING_PAYMENT" },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId,
            fromStatus: b.status,
            toStatus: "PENDING_PAYMENT",
            actor: actor.type,
            actorId: actor.id ?? null,
            note: "Details submitted",
          },
        });
      } else if (b.status === "PENDING_PAYMENT") {
        // Re-editing details before paying is idempotent (no state change).
        await tx.booking.update({ where: { id: bookingId }, data });
      } else {
        assertTransition(b.status, "PENDING_PAYMENT"); // throws InvalidTransitionError
      }
    });
  }

  async submitPayment(
    bookingId: string,
    payment: PaymentInput,
    actor: Actor,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockBooking(tx, bookingId);
      await assertNoActiveCheckout(bookingId, tx);
      const b = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!b) throw new NotFoundError("Booking not found");
      if (isExpiredHold(b)) throw new HoldExpiredError();
      assertTransition(b.status, "PAYMENT_SUBMITTED");

      await tx.paymentSubmission.upsert({
        where: { bookingId },
        create: {
          bookingId,
          channel: payment.channel,
          reference: payment.reference,
          proofKey: payment.proofKey,
          amountCents: payment.amountCents,
          paymentMethodId: payment.paymentMethodId ?? null,
        },
        update: {
          channel: payment.channel,
          reference: payment.reference,
          proofKey: payment.proofKey,
          amountCents: payment.amountCents,
          paymentMethodId: payment.paymentMethodId ?? null,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "PAYMENT_SUBMITTED", holdExpiresAt: null },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: b.status,
          toStatus: "PAYMENT_SUBMITTED",
          actor: actor.type,
          actorId: actor.id ?? null,
          note: "Payment proof submitted",
        },
      });

      // Auto-advance: submitted payment immediately awaits venue confirmation.
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "PENDING_CONFIRMATION" },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: "PAYMENT_SUBMITTED",
          toStatus: "PENDING_CONFIRMATION",
          actor: "SYSTEM",
          note: "Awaiting venue confirmation",
        },
      });
    });
    await safeNotify(() => notificationService.onPaymentSubmitted(bookingId));
  }

  confirm(bookingId: string, actor: Actor): Promise<void> {
    return this.transition(bookingId, "CONFIRMED", actor, "Confirmed by venue");
  }

  reject(bookingId: string, actor: Actor, note?: string): Promise<void> {
    return this.transition(
      bookingId,
      "REJECTED",
      actor,
      note ?? "Rejected by venue",
    );
  }

  cancel(bookingId: string, actor: Actor): Promise<void> {
    return this.transition(bookingId, "CANCELLED", actor, "Cancelled");
  }

  complete(bookingId: string, actor: Actor): Promise<void> {
    return this.transition(bookingId, "COMPLETED", actor, "Marked completed");
  }

  private async transition(
    bookingId: string,
    to: BookingStatus,
    actor: Actor,
    note: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockBooking(tx, bookingId);
      const b = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!b) throw new NotFoundError("Booking not found");
      assertTransition(b.status, to);
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: to,
          ...(isOccupying(to) ? {} : { holdExpiresAt: null }),
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: b.status,
          toStatus: to,
          actor: actor.type,
          actorId: actor.id ?? null,
          note,
        },
      });
    });
    if (to === "CONFIRMED")
      await safeNotify(() => notificationService.onConfirmed(bookingId));
    else if (to === "REJECTED")
      await safeNotify(() => notificationService.onRejected(bookingId));
    else if (to === "CANCELLED")
      await safeNotify(() =>
        notificationService.onCancelled(bookingId, actor.type),
      );
    else if (to === "COMPLETED")
      await safeNotify(() => notificationService.onCompleted(bookingId));
  }

  async expireStale(now = new Date()): Promise<number> {
    const stale = await prisma.booking.findMany({
      where: { status: { in: HOLD_PHASE }, holdExpiresAt: { lt: now } },
      select: { id: true, status: true },
    });
    let count = 0;
    for (const b of stale) {
      const changed = await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: {
            id: b.id,
            status: { in: HOLD_PHASE },
            holdExpiresAt: { lt: now },
          },
          data: { status: "EXPIRED" },
        });
        if (!updated.count) return false;
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: b.id,
            fromStatus: b.status,
            toStatus: "EXPIRED",
            actor: "SYSTEM",
            note: "Hold expired",
          },
        });
        return true;
      });
      if (changed) {
        count++;
        await safeNotify(() => notificationService.onExpired(b.id));
      }
    }
    return count;
  }

  async getOccupied(
    courtId: string,
    from: Date,
    to: Date,
  ): Promise<OccupiedRange[]> {
    const now = new Date();
    const rows = await prisma.booking.findMany({
      where: {
        courtId,
        status: { in: OCCUPYING },
        startsAt: { lt: to },
        endsAt: { gt: from },
        // treat expired-but-unswept holds as free
        NOT: {
          AND: [{ status: { in: HOLD_PHASE } }, { holdExpiresAt: { lt: now } }],
        },
      },
      select: { startsAt: true, endsAt: true, status: true },
      orderBy: { startsAt: "asc" },
    });
    return rows;
  }

  async getStatus(
    bookingId: string,
  ): Promise<{ status: BookingStatus; externalRef: string | null }> {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, externalRef: true },
    });
    if (!b) throw new NotFoundError("Booking not found");
    return { status: b.status, externalRef: b.externalRef };
  }
}
