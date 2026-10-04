import { NextRequest, NextResponse } from "next/server";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { assertFullAppEnabled } from "@/lib/deployment";
import { reconcileCheckout } from "@/lib/payments/paymongo/checkout";
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
    return NextResponse.json(
      { checkout: await reconcileCheckout(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
