import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";
import {
  normalizeCourtTimeRates,
  validateCourtPrice,
} from "@/lib/court-pricing";
import { assertLocalCourtPricing } from "@/lib/venue/court";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireEditableOwnVenue(id);
    await assertLocalCourtPricing(id);
    const b = (await req.json()) as Record<string, unknown>;

    const name = String(b.name ?? "").trim();
    if (!name) throw new ValidationError("Court name is required");
    const priceCents = validateCourtPrice(b.priceCents);
    const timeRates = normalizeCourtTimeRates(b.timeRates);

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
        timeRates,
        active: b.active !== false,
        sortOrder,
      },
    });
    return NextResponse.json({ court });
  } catch (e) {
    return errorResponse(e);
  }
}
