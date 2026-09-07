import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assertVenueAccess } from "@/lib/auth/guards";
import { paymentProofStorage } from "@/lib/storage";
import { errorResponse } from "@/lib/http";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/booking/errors";

/**
 * Serve a payment-proof image only to people entitled to see it: the booking's
 * customer, the venue's owner/staff, or an admin. Never public.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();

    const key = (await params).key.join("/");
    const submission = await prisma.paymentSubmission.findFirst({
      where: { proofKey: key },
      include: { booking: true },
    });
    if (!submission) throw new NotFoundError("Proof not found");

    const booking = submission.booking;
    const isCustomer = !!booking.userId && booking.userId === session.id;
    let allowed = isCustomer || session.role === "ADMIN";
    if (!allowed) {
      try {
        await assertVenueAccess(session.id, session.role, booking.venueId);
        allowed = true;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) throw new ForbiddenError();

    const { bytes, contentType } = await paymentProofStorage.getBytes(key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
