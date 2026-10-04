import type { Prisma } from "@/generated/prisma";

/** Serialize payment, cancellation and detail edits on the same reservation. */
export async function lockBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
}
