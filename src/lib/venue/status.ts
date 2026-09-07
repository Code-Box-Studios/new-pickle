import type { VenueStatus } from "@/generated/prisma";
import { ConflictError } from "@/lib/booking/errors";

/**
 * Venue lifecycle. Publishing is orthogonal (a boolean `isPublished`), not a
 * status — see the publish rules. Reinstating a suspended venue returns it to
 * APPROVED but leaves it unpublished (no auto-relist).
 */
const TRANSITIONS: Record<VenueStatus, VenueStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  REJECTED: ["PENDING_REVIEW"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
};

export function canVenueTransition(from: VenueStatus, to: VenueStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertVenueTransition(from: VenueStatus, to: VenueStatus): void {
  if (!canVenueTransition(from, to)) {
    throw new ConflictError(`Cannot move venue from ${from} to ${to}`);
  }
}

/** Owners may edit unless the venue is under review. */
export function assertVenueEditable(status: VenueStatus): void {
  if (status === "PENDING_REVIEW") {
    throw new ConflictError("This venue is under review and can't be edited right now");
  }
}
