import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { assertCourtDeletable } from "@/lib/venue/court";
import { errorResponse } from "@/lib/http";

async function loadCourt(venueId: string, courtId: string) {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court || court.venueId !== venueId) throw new NotFoundError("Court not found");
  return court;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; courtId: string }> },
) {
  try {
    const { id, courtId } = await params;
    await requireEditableOwnVenue(id);
    await loadCourt(id, courtId);
    const b = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) throw new ValidationError("Court name is required");
      data.name = name;
    }
    if (b.priceCents !== undefined) {
      const p = Math.round(Number(b.priceCents));
      if (!Number.isFinite(p) || p < 0) throw new ValidationError("Enter a valid price");
      data.priceCents = p;
    }
    if (b.indoor !== undefined) data.indoor = !!b.indoor;
    if (b.covered !== undefined) data.covered = !!b.covered;
    if (b.surface !== undefined) data.surface = b.surface ? String(b.surface) : null;
    if (b.capacity !== undefined) data.capacity = Number(b.capacity) || 4;
    if (b.active !== undefined) data.active = !!b.active;

    const court = await prisma.court.update({ where: { id: courtId }, data });
    return NextResponse.json({ court });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; courtId: string }> },
) {
  try {
    const { id, courtId } = await params;
    await requireEditableOwnVenue(id);
    await loadCourt(id, courtId);
    await assertCourtDeletable(courtId);
    await prisma.court.delete({ where: { id: courtId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
