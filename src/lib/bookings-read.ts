import prisma from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

/** Load a booking by public reference, scoped to its owner (or admin). */
export async function getBookingByReference(
  reference: string,
  userId: string,
  role: Role,
) {
  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      venue: {
        include: {
          paymentMethods: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      court: true,
      payment: true,
      history: { orderBy: { at: "asc" } },
    },
  });
  if (!booking) return null;
  if (booking.userId !== userId && role !== "ADMIN") return null;
  return booking;
}

export async function listUserBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: { venue: true, court: true },
    orderBy: { startsAt: "desc" },
  });
}
