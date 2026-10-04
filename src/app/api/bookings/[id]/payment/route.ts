import { NextRequest, NextResponse } from "next/server";
import { bookingBackend } from "@/lib/booking";
import { ValidationError } from "@/lib/booking/errors";
import { paymentProofStorage } from "@/lib/storage";
import { requireOwnBooking } from "@/lib/api/booking-access";
import { errorResponse } from "@/lib/http";
import type { ActorKind } from "@/lib/booking/backend";
import type { PaymentChannel } from "@/generated/prisma";
import { assertNoActiveCheckout } from "@/lib/payments/paymongo/guard";

const CHANNELS: PaymentChannel[] = ["GCASH", "MAYA", "BANK_TRANSFER", "CASH"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, booking } = await requireOwnBooking(id);
    await assertNoActiveCheckout(id);

    const form = await req.formData();
    const channel = String(form.get("channel") ?? "");
    const reference = String(form.get("reference") ?? "").trim();
    const paymentMethodId = form.get("paymentMethodId")
      ? String(form.get("paymentMethodId"))
      : undefined;
    const file = form.get("proof");

    if (!CHANNELS.includes(channel as PaymentChannel)) {
      throw new ValidationError("Select a payment method");
    }
    if (!reference)
      throw new ValidationError("Enter the payment reference number");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("Upload a payment screenshot");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { key } = await paymentProofStorage.save({
      bytes,
      contentType: file.type,
    });

    await bookingBackend.submitPayment(
      id,
      {
        channel: channel as PaymentChannel,
        reference,
        proofKey: key,
        // Amount is the server-computed booking total, never the client's word.
        amountCents: booking.priceCents,
        paymentMethodId,
      },
      { type: session.role as ActorKind, id: session.id },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
