import prisma from "@/lib/prisma";
import type { VenueStatus } from "@/generated/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { assertVenueTransition } from "./status";
import { venueForCompleteness } from "./queries";
import { venueCompleteness } from "./completeness";

/** Owner action: submit a DRAFT/REJECTED venue for admin review. */
export async function submitVenueForReview(venueId: string, note: string): Promise<void> {
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
  assertVenueTransition(venue.status, "PENDING_REVIEW");
  if (!note?.trim()) throw new ValidationError("Add a short note for the reviewer");

  const full = await venueForCompleteness(venueId);
  const c = venueCompleteness(full!);
  if (!c.ok) throw new ValidationError(`Please complete: ${c.missing.join(", ")}`);

  await prisma.$transaction(async (tx) => {
    await tx.venue.update({ where: { id: venueId }, data: { status: "PENDING_REVIEW" } });
    await tx.venueVerification.upsert({
      where: { venueId },
      create: { venueId, status: "PENDING_REVIEW", submittedNote: note.trim() },
      update: {
        status: "PENDING_REVIEW",
        submittedNote: note.trim(),
        notes: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });
  });
}

/**
 * Admin decision. `to` is APPROVED (approve/reinstate), REJECTED, or SUSPENDED.
 * Suspending also forces the venue offline; reinstating does NOT auto-relist.
 */
export async function reviewVenue(
  venueId: string,
  to: VenueStatus,
  adminId: string,
  reason: string | null,
  at: Date,
): Promise<void> {
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
  assertVenueTransition(venue.status, to);
  await prisma.$transaction(async (tx) => {
    await tx.venue.update({
      where: { id: venueId },
      data: { status: to, ...(to === "SUSPENDED" ? { isPublished: false } : {}) },
    });
    await tx.venueVerification.upsert({
      where: { venueId },
      create: { venueId, status: to, notes: reason, reviewedBy: adminId, reviewedAt: at },
      update: { status: to, notes: reason, reviewedBy: adminId, reviewedAt: at },
    });
  });
}
