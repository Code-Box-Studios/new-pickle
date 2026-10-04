import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveBackend } from "@/lib/booking/resolve";
import { NotFoundError, ValidationError } from "@/lib/booking/errors";
import { requireOperationalOwnVenue } from "@/lib/api/owner-venue-access";
import { assertNoBlockOverlap } from "@/lib/venue/blocks";
import { errorResponse } from "@/lib/http";
import { courtIntervalPrice } from "@/lib/court-pricing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireOperationalOwnVenue(id);
    const b = (await req.json()) as Record<string, unknown>;

    const court = await prisma.court.findUnique({
      where: { id: String(b.courtId ?? "") },
    });
    if (!court || court.venueId !== id || !court.active)
      throw new NotFoundError("Court not found");

    const startsAt = new Date(String(b.startsAt ?? ""));
    if (Number.isNaN(startsAt.getTime()))
      throw new ValidationError("Invalid start time");
    const durationMinutes = Number(b.durationMinutes ?? court.slotMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
      throw new ValidationError("Invalid duration");
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const name = String(b.name ?? "").trim();
    if (!name) throw new ValidationError("Customer name is required");

    await assertNoBlockOverlap(id, court.id, startsAt, endsAt);

    const priceCents = courtIntervalPrice(court, startsAt, endsAt);
    const noteParts: string[] = [];
    if (b.paymentMethod) noteParts.push(String(b.paymentMethod));
    if (b.note) noteParts.push(String(b.note));

    const backend = await resolveBackend(id);
    const w = await backend.createWalkIn({
      venueId: id,
      courtId: court.id,
      startsAt,
      endsAt,
      priceCents,
      userId: null,
      customer: {
        name,
        mobile: b.mobile ? String(b.mobile) : null,
        email: b.email ? String(b.email) : null,
      },
      note: noteParts.join(" · ") || null,
    });
    return NextResponse.json({ id: w.id, reference: w.reference });
  } catch (e) {
    return errorResponse(e);
  }
}
