import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { AppError, ValidationError } from "@/lib/booking/errors";
import { merchantByAlias } from "@/lib/payments/paymongo/config";
import { verifyWebhook, parsePaidEvent } from "@/lib/payments/paymongo/webhook";
import { settlePayment } from "@/lib/payments/paymongo/settlement";
import {
  readWebhook,
  paymentErrorResponse,
} from "@/lib/payments/paymongo/http";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ merchant: string; mode: string }> },
) {
  try {
    const { merchant: alias, mode } = await params;
    const merchant = merchantByAlias(alias, mode),
      raw = await readWebhook(req);
    verifyWebhook(raw, req.headers.get("paymongo-signature"), merchant);
    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new ValidationError("Invalid webhook JSON");
    }
    const event = parsePaidEvent(payload);
    if (!event) {
      const envelope =
        payload?.data?.type === "event"
          ? payload.data.attributes
          : payload?.data;
      if (envelope?.type === "checkout_session.payment.paid")
        throw new AppError(
          "Payment event could not be validated",
          400,
          "invalid_payment_event",
        );
      return NextResponse.json({ received: true, ignored: true });
    }
    // Commit the receipt before acknowledging. Notifications are deferred by Next's lifecycle.
    const outcome = await settlePayment(merchant, event, (notification) =>
      after(notification),
    );
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
