import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ConflictError } from "@/lib/booking/errors";
import { ledgerReady } from "./config";

export async function assertNoActiveCheckout(
  bookingId: string,
  db: Prisma.TransactionClient = prisma,
) {
  return assertCheckoutResolved(bookingId, db, false);
}

export async function assertCheckoutAllowsReschedule(
  bookingId: string,
  db: Prisma.TransactionClient = prisma,
) {
  return assertCheckoutResolved(bookingId, db, true);
}

async function assertCheckoutResolved(
  bookingId: string,
  db: Prisma.TransactionClient,
  permitPaid: boolean,
) {
  if (!ledgerReady()) return;
  const checkout = await db.paymentCheckout.findUnique({
    where: { bookingId },
    select: { status: true },
  });
  if (
    checkout &&
    !["FAILED", "EXPIRED"].includes(checkout.status) &&
    !(permitPaid && checkout.status === "PAID")
  ) {
    throw new ConflictError(
      permitPaid
        ? "An online checkout needs to be resolved before moving this reservation. Check its payment status."
        : "An online payment is already in progress. Check its status before paying another way.",
    );
  }
}
