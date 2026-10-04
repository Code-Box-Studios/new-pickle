import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ConflictError } from "@/lib/booking/errors";
import { ledgerReady } from "./config";

export async function assertNoActiveCheckout(
  bookingId: string,
  db: Prisma.TransactionClient = prisma,
) {
  if (!ledgerReady()) return;
  const checkout = await db.paymentCheckout.findUnique({
    where: { bookingId },
    select: { status: true },
  });
  if (checkout && !["FAILED", "EXPIRED"].includes(checkout.status)) {
    throw new ConflictError(
      "An online payment is already in progress. Check its status before paying another way.",
    );
  }
}
