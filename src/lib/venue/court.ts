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

/** A connected external backend owns court pricing; local edits would diverge. */
export async function assertLocalCourtPricing(venueId: string): Promise<void> {
  const connection = await prisma.sentryConnection.findUnique({
    where: { venueId },
    select: { connectionState: true },
  });
  if (connection?.connectionState === "CONNECTED") {
    throw new ConflictError(
      "Manage court rates in Sentry for this connected venue",
    );
  }
}
