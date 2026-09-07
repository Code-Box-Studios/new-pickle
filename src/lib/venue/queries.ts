import prisma from "@/lib/prisma";

/** Load a venue with exactly the relations `venueCompleteness` needs. */
export function venueForCompleteness(id: string) {
  return prisma.venue.findUnique({
    where: { id },
    include: {
      courts: { include: { schedules: { select: { id: true } } } },
      paymentMethods: true,
    },
  });
}
