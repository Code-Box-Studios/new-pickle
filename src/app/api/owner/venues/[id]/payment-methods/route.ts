import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";
import type { PaymentChannel } from "@/generated/prisma";

const CHANNELS: PaymentChannel[] = ["GCASH", "MAYA", "BANK_TRANSFER", "CASH"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireEditableOwnVenue(id);
    const b = (await req.json()) as Record<string, unknown>;
    const channel = String(b.channel ?? "");
    if (!CHANNELS.includes(channel as PaymentChannel)) throw new ValidationError("Choose a payment channel");
    const accountName = String(b.accountName ?? "").trim();
    const accountNumber = String(b.accountNumber ?? "").trim();
    if (!accountName || !accountNumber) throw new ValidationError("Account name and number are required");

    const sortOrder = await prisma.paymentMethod.count({ where: { venueId: id } });
    const method = await prisma.paymentMethod.create({
      data: {
        venueId: id,
        channel: channel as PaymentChannel,
        accountName,
        accountNumber,
        instructions: b.instructions ? String(b.instructions) : null,
        active: b.active !== false,
        sortOrder,
      },
    });
    return NextResponse.json({ method });
  } catch (e) {
    return errorResponse(e);
  }
}
