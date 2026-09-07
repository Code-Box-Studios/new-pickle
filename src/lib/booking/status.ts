import type { BookingStatus } from "@/generated/prisma";
import { InvalidTransitionError } from "./errors";

/**
 * Statuses that occupy a court's time. These are exactly the statuses covered
 * by the `bookings_no_overlap` EXCLUDE constraint in the database, so the app
 * definition and the DB guarantee stay in lockstep.
 */
export const OCCUPYING: BookingStatus[] = [
  "HELD",
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
];

/** Statuses for which a hold countdown applies and auto-expiry can fire. */
export const HOLD_PHASE: BookingStatus[] = ["HELD", "PENDING_PAYMENT"];

export function isOccupying(status: BookingStatus): boolean {
  return OCCUPYING.includes(status);
}

/** Allowed forward transitions. Terminal states have no outgoing edges. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  HELD: ["PENDING_PAYMENT", "EXPIRED", "CANCELLED"],
  PENDING_PAYMENT: ["PAYMENT_SUBMITTED", "EXPIRED", "CANCELLED"],
  PAYMENT_SUBMITTED: ["PENDING_CONFIRMATION", "REJECTED", "CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
  REJECTED: [],
  COMPLETED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(
      `Cannot move booking from ${from} to ${to}`,
    );
  }
}
