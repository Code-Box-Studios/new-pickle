import type { BookingStatus } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { newReference } from "./reference";
import type { SentryClient } from "@/lib/sentry/port";
import { SentryInvalidResourceError, SentryUnsupportedOperationError } from "@/lib/sentry/errors";
import { busyRangesToOccupied, externalStateToStatus, holdInputToCreateBooking } from "@/lib/sentry/mapping";
import type { Actor, BookingBackend, HeldBooking, HoldInput, OccupiedRange } from "./backend";

// Sentry is authoritative for connected venues. The Pikol Booking row is an
// INDEX (backendType=SENTRY, externalRef, last-known status), never the authority.
export class SentryBookingBackend implements BookingBackend {
  constructor(private readonly client: SentryClient) {}

  private async resourceRef(courtId: string): Promise<string> {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { externalRef: true } });
    if (!court?.externalRef) throw new SentryInvalidResourceError("Court is not mapped to a Sentry resource");
    return court.externalRef;
  }

  async getOccupied(courtId: string, from: Date, to: Date): Promise<OccupiedRange[]> {
    const resourceRef = await this.resourceRef(courtId);
    const busy = await this.client.getAvailability({ resourceRef, from, to });
    return busyRangesToOccupied(busy);
  }

  async createHold(input: HoldInput): Promise<HeldBooking> {
    // Idempotency short-circuit against the local index (replay-safe).
    if (input.idempotencyKey) {
      const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        return { id: existing.id, reference: existing.reference, status: existing.status, holdExpiresAt: existing.holdExpiresAt };
      }
    }
    const resourceRef = await this.resourceRef(input.courtId);
    const remote = await this.client.createBooking(holdInputToCreateBooking(input, resourceRef));
    const status = externalStateToStatus(remote.state);
    const booking = await prisma.booking.create({
      data: {
        reference: newReference(),
        venueId: input.venueId,
        courtId: input.courtId,
        userId: input.userId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status,
        holdExpiresAt: null,
        priceCents: input.priceCents,
        source: "ONLINE",
        backendType: "SENTRY",
        externalRef: remote.externalRef,
        idempotencyKey: input.idempotencyKey ?? null,
        customerName: input.customer.name ?? null,
        customerMobile: input.customer.mobile ?? null,
        customerEmail: input.customer.email ?? null,
      },
    });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, toStatus: status, actor: "SYSTEM", note: "Created via Sentry" },
    });
    return { id: booking.id, reference: booking.reference, status: booking.status, holdExpiresAt: null };
  }

  async cancel(bookingId: string, actor: Actor): Promise<void> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { externalRef: true, status: true } });
    if (!b?.externalRef) throw new NotFoundError("Sentry booking not found");
    const remote = await this.client.cancelBooking(b.externalRef);
    const status = externalStateToStatus(remote.state);
    await prisma.booking.update({ where: { id: bookingId }, data: { status } });
    await prisma.bookingStatusHistory.create({
      data: { bookingId, fromStatus: b.status, toStatus: status, actor: actor.type, actorId: actor.id ?? null, note: "Cancelled via Sentry" },
    });
  }

  async getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { externalRef: true } });
    if (!b?.externalRef) throw new NotFoundError("Sentry booking not found");
    const remote = await this.client.getBooking(b.externalRef);
    const status = externalStateToStatus(remote.state);
    // Refresh ONLY the last-known local index state.
    await prisma.booking.update({ where: { id: bookingId }, data: { status } });
    return { status, externalRef: b.externalRef };
  }

  // --- Out-of-phase for Sentry venues (documented). Signatures satisfy the
  // BookingBackend interface; params are omitted since each throws immediately. ---
  async createWalkIn(): Promise<HeldBooking> {
    throw new SentryUnsupportedOperationError();
  }
  async reschedule(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async submitDetails(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async submitPayment(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async confirm(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async reject(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async complete(): Promise<void> {
    throw new SentryUnsupportedOperationError();
  }
  async expireStale(): Promise<number> {
    return 0;
  }
}
