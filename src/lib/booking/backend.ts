import type { BookingStatus, PaymentChannel, BookingSource } from "@/generated/prisma";

/**
 * The occupancy seam. `LocalBookingBackend` is authoritative in this slice; a
 * future `SentryBookingBackend` will implement the same interface while
 * delegating to Sentry's Public Bookings API for connected venues. Callers
 * (API routes, engines) depend only on this interface.
 */

export interface CustomerDetails {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
}

export interface HoldInput {
  venueId: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  /** Server-computed total; never trusted from the client. */
  priceCents: number;
  userId?: string | null;
  idempotencyKey?: string | null;
  source?: BookingSource;
  customer: CustomerDetails;
}

export interface HeldBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  holdExpiresAt: Date | null;
}

export type ActorKind = "SYSTEM" | "CUSTOMER" | "OWNER" | "STAFF" | "ADMIN";

export interface Actor {
  type: ActorKind;
  id?: string | null;
}

export interface PaymentInput {
  channel: PaymentChannel;
  reference: string;
  proofKey: string;
  amountCents: number;
  paymentMethodId?: string | null;
}

export interface OccupiedRange {
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
}

export interface WalkInInput extends HoldInput {
  note?: string | null;
}

export interface BookingBackend {
  createHold(input: HoldInput): Promise<HeldBooking>;
  /** Owner-created booking, confirmed on creation (no payment workflow). */
  createWalkIn(input: WalkInInput): Promise<HeldBooking>;
  /** Move a non-terminal booking to a new time; EXCLUDE guards overlap. */
  reschedule(bookingId: string, startsAt: Date, endsAt: Date, actor: Actor): Promise<void>;
  submitDetails(
    bookingId: string,
    customer: CustomerDetails,
    actor: Actor,
  ): Promise<void>;
  submitPayment(
    bookingId: string,
    payment: PaymentInput,
    actor: Actor,
  ): Promise<void>;
  confirm(bookingId: string, actor: Actor): Promise<void>;
  reject(bookingId: string, actor: Actor, note?: string): Promise<void>;
  cancel(bookingId: string, actor: Actor): Promise<void>;
  complete(bookingId: string, actor: Actor): Promise<void>;
  /** Flip HELD/PENDING_PAYMENT rows past their holdExpiresAt to EXPIRED. */
  expireStale(now?: Date): Promise<number>;
  /** Currently-occupying ranges on a court within [from, to). */
  getOccupied(courtId: string, from: Date, to: Date): Promise<OccupiedRange[]>;
  /** Current normalized status. LOCAL reads its own row; SENTRY refreshes from Sentry. */
  getStatus(bookingId: string): Promise<{ status: BookingStatus; externalRef: string | null }>;
}
