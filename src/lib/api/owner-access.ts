import prisma from "@/lib/prisma";
import { assertVenueAccess, requireRole } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/booking/errors";

/** Require an owner/staff/admin who manages the booking's venue. */
export async function requireVenueBooking(bookingId: string) {
  const session = await requireRole("OWNER", "STAFF");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError("Booking not found");
  await assertVenueAccess(session.id, session.role, booking.venueId);
  return { session, booking };
}

/** Venue ids the current user may manage. */
export async function accessibleVenueIds(userId: string, role: string): Promise<string[]> {
  const venues = await prisma.venue.findMany({
    where:
      role === "ADMIN"
        ? {}
        : { OR: [{ ownerId: userId }, { staff: { some: { userId } } }] },
    select: { id: true },
  });
  return venues.map((v) => v.id);
}
