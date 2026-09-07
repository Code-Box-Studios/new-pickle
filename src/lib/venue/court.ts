import prisma from "@/lib/prisma";
import { ConflictError } from "@/lib/booking/errors";
import { OCCUPYING } from "@/lib/booking/status";

/** A court with live (occupying) bookings must not be deleted — deactivate instead. */
export async function assertCourtDeletable(courtId: string): Promise<void> {
  const n = await prisma.booking.count({
    where: { courtId, status: { in: OCCUPYING } },
  });
  if (n > 0) {
    throw new ConflictError(
      "This court has active bookings and can't be deleted. Deactivate it instead.",
    );
  }
}
