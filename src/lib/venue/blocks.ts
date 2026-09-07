import prisma from "@/lib/prisma";
import { ConflictError, ValidationError } from "@/lib/booking/errors";
import { HOLD_PHASE, OCCUPYING } from "@/lib/booking/status";
import type { ExceptionType } from "@/generated/prisma";

/** Live (occupying, non-expired) bookings overlapping a range on given courts. */
function overlappingBookingWhere(courtIds: string[], startsAt: Date, endsAt: Date, now: Date) {
  return {
    courtId: { in: courtIds },
    status: { in: OCCUPYING },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
    NOT: { AND: [{ status: { in: HOLD_PHASE } }, { holdExpiresAt: { lt: now } }] },
  };
}

/** Throw if [startsAt,endsAt) on this court (or a venue-wide block) is blocked. */
export async function assertNoBlockOverlap(
  venueId: string,
  courtId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  const hit = await prisma.scheduleException.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: [{ courtId }, { courtId: null, venueId }],
    },
  });
  if (hit) throw new ConflictError("That time is blocked (maintenance or closed).");
}

export interface CreateBlockInput {
  venueId: string;
  courtId: string | null; // null = venue-wide
  startsAt: Date;
  endsAt: Date;
  type: ExceptionType;
  reason?: string | null;
}

/**
 * Create a block. Refuses (explicit conflict, no silent invalidation) if it
 * overlaps an active future booking on any affected court.
 */
export async function createBlock(input: CreateBlockInput) {
  if (input.endsAt <= input.startsAt) throw new ValidationError("End time must be after start time");
  const now = new Date();

  const courtIds = input.courtId
    ? [input.courtId]
    : (
        await prisma.court.findMany({ where: { venueId: input.venueId, active: true }, select: { id: true } })
      ).map((c) => c.id);

  const conflict = await prisma.booking.findFirst({
    where: overlappingBookingWhere(courtIds, input.startsAt, input.endsAt, now),
    select: { reference: true },
  });
  if (conflict) {
    throw new ConflictError(
      `That period overlaps booking ${conflict.reference}. Cancel or reschedule it before blocking.`,
    );
  }

  return prisma.scheduleException.create({
    data: {
      venueId: input.venueId,
      courtId: input.courtId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      type: input.type,
      reason: input.reason ?? null,
    },
  });
}

export async function removeBlock(id: string): Promise<void> {
  await prisma.scheduleException.delete({ where: { id } });
}
