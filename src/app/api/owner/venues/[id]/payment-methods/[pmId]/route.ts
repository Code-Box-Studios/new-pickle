import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";

async function loadMethod(venueId: string, pmId: string) {
  const pm = await prisma.paymentMethod.findUnique({ where: { id: pmId } });
  if (!pm || pm.venueId !== venueId) throw new NotFoundError("Payment method not found");
  return pm;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pmId: string }> },
) {
  try {
    const { id, pmId } = await params;
    await requireEditableOwnVenue(id);
    await loadMethod(id, pmId);
    const b = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (b.accountName !== undefined) {
      const v = String(b.accountName).trim();
      if (!v) throw new ValidationError("Account name is required");
      data.accountName = v;
    }
    if (b.accountNumber !== undefined) {
      const v = String(b.accountNumber).trim();
      if (!v) throw new ValidationError("Account number is required");
      data.accountNumber = v;
    }
    if (b.instructions !== undefined) data.instructions = b.instructions ? String(b.instructions) : null;
    if (b.active !== undefined) data.active = !!b.active;

    const method = await prisma.paymentMethod.update({ where: { id: pmId }, data });
    return NextResponse.json({ method });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pmId: string }> },
) {
  try {
    const { id, pmId } = await params;
    await requireEditableOwnVenue(id);
    await loadMethod(id, pmId);
    await prisma.paymentMethod.delete({ where: { id: pmId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
