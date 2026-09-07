import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveBackend } from "@/lib/booking/resolve";
import { courtSlotsForDate } from "@/lib/availability/engine";
import {
  NotFoundError,
  SlotTakenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";

/** Create a HELD reservation. Price + availability are recomputed server-side. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError("Please sign in to reserve a court");

    // Idempotency short-circuit: a replay must return the same booking, even
    // though the slot now reads as occupied by that first hold.
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
    if (idempotencyKey) {
      const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
      if (existing && existing.userId === session.id) {
        return NextResponse.json({
          id: existing.id,
          reference: existing.reference,
          holdExpiresAt: existing.holdExpiresAt,
        });
      }
    }

    const body = (await req.json()) as {
      courtId?: string;
      startsAt?: string;
      durationMinutes?: number;
    };
    if (!body.courtId || !body.startsAt) throw new ValidationError("Missing court or time");

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new ValidationError("Invalid time");

    const court = await prisma.court.findUnique({
      where: { id: body.courtId },
      include: { venue: true },
    });
    if (
      !court ||
      !court.active ||
      !court.venue.isPublished ||
      court.venue.status !== "APPROVED"
    ) {
      throw new NotFoundError("Court not available");
    }

    const durationMinutes = Number(body.durationMinutes ?? court.slotMinutes);
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0 ||
      durationMinutes % court.slotMinutes !== 0
    ) {
      throw new ValidationError("Invalid duration");
    }

    // Recompute availability + price authoritatively; never trust the client.
    const slots = await courtSlotsForDate(court.id, startsAt, { durationMinutes });
    const match = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
    if (!match) throw new ValidationError("That time isn't bookable");
    if (!match.available) throw new SlotTakenError();

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const backend = await resolveBackend(court.venueId);
    const held = await backend.createHold({
      venueId: court.venueId,
      courtId: court.id,
      startsAt,
      endsAt,
      priceCents: match.priceCents,
      userId: session.id,
      idempotencyKey,
      customer: { email: session.email },
    });

    return NextResponse.json({
      id: held.id,
      reference: held.reference,
      holdExpiresAt: held.holdExpiresAt,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
