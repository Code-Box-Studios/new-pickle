import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireEditableOwnVenue(id);
    const b = (await req.json()) as Record<string, unknown>;

    const name = String(b.name ?? "").trim();
    if (!name) throw new ValidationError("Court name is required");
    const priceCents = Math.round(Number(b.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw new ValidationError("Enter a valid price");
    }

    const sortOrder = await prisma.court.count({ where: { venueId: id } });
    const court = await prisma.court.create({
      data: {
        venueId: id,
        name,
        indoor: b.indoor !== false,
        covered: !!b.covered,
        surface: b.surface ? String(b.surface) : null,
        capacity: Number(b.capacity) || 4,
        priceCents,
        active: b.active !== false,
        sortOrder,
      },
    });
    return NextResponse.json({ court });
  } catch (e) {
    return errorResponse(e);
  }
}
