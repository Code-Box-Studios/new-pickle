import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { ForbiddenError, NotFoundError } from "@/lib/booking/errors";

/** Load a booking and assert the current user owns it (or is admin). */
export async function requireOwnBooking(id: string) {
  const session = await requireUser();
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new NotFoundError("Booking not found");
  if (booking.userId !== session.id && session.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return { session, booking };
}
