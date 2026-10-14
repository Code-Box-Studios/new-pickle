import "server-only";
import type { Prisma } from "@/generated/prisma";

/** Runs inside the existing Pasalo booking transaction before ownership changes. */
export async function revokePlayerInvitationsOnTransfer(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.playerInvitation.updateMany({ where: { bookingId, status: "OPEN" }, data: { status: "REVOKED", respondedAt: new Date(Date.now()) } });
  // Accepted memberships and guest entries are independent of booking ownership.
}
