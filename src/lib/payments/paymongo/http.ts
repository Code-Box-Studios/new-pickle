import { NextRequest, NextResponse } from "next/server";
import { AppError, ForbiddenError } from "@/lib/booking/errors";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { errorResponse } from "@/lib/http";

export function assertPaymentOrigin(req: NextRequest) {
  if (!req.headers.get("origin"))
    throw new ForbiddenError("Open Pikol directly to manage your payment.");
  assertPhoneOrigin(req);
}
export function paymentErrorResponse(error: unknown) {
  if (error instanceof AppError) return errorResponse(error);
  console.error(
    "[paymongo] internal operation failed; check the payment ledger",
  );
  return NextResponse.json(
    {
      error:
        "We could not check this payment. Please check your booking before paying again.",
    },
    { status: 500 },
  );
}
export async function readWebhook(req: NextRequest): Promise<Buffer> {
  const limit = 65536;
  if (Number(req.headers.get("content-length")) > limit)
    throw new AppError("Webhook body is too large", 413, "body_too_large");
  const reader = req.body?.getReader();
  if (!reader)
    throw new AppError("Missing webhook body", 400, "invalid_webhook");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("Webhook body is too large", 413, "body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
