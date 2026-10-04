import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AppError, UnauthorizedError } from "@/lib/booking/errors";
import { ledgerReady } from "@/lib/payments/paymongo/config";
import { reconcileCheckout } from "@/lib/payments/paymongo/checkout";
import { paymentErrorResponse } from "@/lib/payments/paymongo/http";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Schedule once per minute with a private Authorization header; never put secrets in a URL. */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32)
      throw new AppError(
        "Payment reconciliation is not configured",
        503,
        "payments_unavailable",
      );
    const expected = Buffer.from(`Bearer ${secret}`),
      actual = Buffer.from(req.headers.get("authorization") ?? "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedError();
    if (!ledgerReady())
      return NextResponse.json(
        { disabled: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    const now = new Date();
    await prisma.paymentCheckout.updateMany({
      where: {
        status: "CREATING",
        createdAt: { lt: new Date(Date.now() - 120000) },
      },
      data: { status: "REVIEW", reviewReason: "create_response_unconfirmed" },
    });
    const due = await prisma.paymentCheckout.findMany({
      where: {
        status: { in: ["PENDING", "REVIEW"] },
        sessionId: { not: null },
        holdExpiresAt: { lt: now },
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: new Date(Date.now() - 60000) } },
        ],
        // Old reviews require manual reconciliation; do not re-fetch them indefinitely.
        createdAt: { gt: new Date(Date.now() - 86400000) },
      },
      orderBy: { lastCheckedAt: "asc" },
      take: 9,
      select: { bookingId: true },
    });
    let checked = 0,
      failed = 0;
    for (let offset = 0; offset < due.length; offset += 3) {
      await Promise.all(
        due.slice(offset, offset + 3).map(async (entry) => {
          try {
            await reconcileCheckout(entry.bookingId);
            checked++;
          } catch {
            failed++;
            console.error(
              "[paymongo] scheduled reconciliation failed; review pending payments",
            );
          }
        }),
      );
    }
    return NextResponse.json(
      { checked, failed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
