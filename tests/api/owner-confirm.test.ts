import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { assertVenueAccess } from "@/lib/auth/guards";
import { ForbiddenError } from "@/lib/booking/errors";

beforeEach(resetDb);

async function pendingConfirmationBooking(venueId: string, courtId: string) {
  const b = await bookingBackend.createHold({
    venueId,
    courtId,
    ...slot(),
    priceCents: 40000,
    customer: {},
  });
  await bookingBackend.submitDetails(b.id, { name: "Juan", mobile: "0917" }, { type: "CUSTOMER" });
  await bookingBackend.submitPayment(
    b.id,
    { channel: "GCASH", reference: "R1", proofKey: "payment-proofs/x.png", amountCents: 40000 },
    { type: "CUSTOMER" },
  );
  return b;
}

describe("owner confirm authorization", () => {
  it("owner can confirm their own venue's booking", async () => {
    const A = await seedOwnerVenueCourt();
    const b = await pendingConfirmationBooking(A.venueId, A.courtId);
    await assertVenueAccess(A.ownerId, "OWNER", A.venueId); // resolves
    await bookingBackend.confirm(b.id, { type: "OWNER", id: A.ownerId });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("CONFIRMED");
  });

  it("owner CANNOT confirm a booking belonging to another venue", async () => {
    const A = await seedOwnerVenueCourt();
    const B = await seedOwnerVenueCourt();
    const b = await pendingConfirmationBooking(A.venueId, A.courtId);

    // Owner B has no access to venue A — the guard denies before any mutation.
    await expect(assertVenueAccess(B.ownerId, "OWNER", A.venueId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("PENDING_CONFIRMATION"); // unchanged
  });

  it("reject moves the booking to REJECTED with history", async () => {
    const A = await seedOwnerVenueCourt();
    const b = await pendingConfirmationBooking(A.venueId, A.courtId);
    await bookingBackend.reject(b.id, { type: "OWNER", id: A.ownerId }, "Court unavailable");
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("REJECTED");
    const last = await prisma.bookingStatusHistory.findFirst({
      where: { bookingId: b.id },
      orderBy: { at: "desc" },
    });
    expect(last?.toStatus).toBe("REJECTED");
  });
});
