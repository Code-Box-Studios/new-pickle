import { NextRequest, NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { assertFullAppEnabled } from "@/lib/deployment";
import { reconcileCheckout } from "@/lib/payments/paymongo/checkout";
import prisma from "@/lib/prisma";
import {
  assertPaymentOrigin,
  paymentErrorResponse,
} from "@/lib/payments/paymongo/http";

export const runtime = "nodejs";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertFullAppEnabled();
    assertPaymentOrigin(req);
    const { id } = await params;
    await requireOwnBooking(id);
    const transfer = await prisma.pasaloListing.findUnique({ where: { bookingId: id }, select: { status: true } });
    if (transfer?.status === "SOLD") return NextResponse.json({ checkout: null }, { headers: { "Cache-Control": "private, no-store" } });
    const checkout = await reconcileCheckout(id);
    // Provider reconciliation may take long enough for ownership to change.
    await requireOwnBooking(id);
    const after = await prisma.pasaloListing.findUnique({ where: { bookingId: id }, select: { status: true } });
    return NextResponse.json(
      { checkout: after?.status === "SOLD" ? null : checkout },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
