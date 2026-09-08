import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { uniqueVenueSlug } from "@/lib/venue/slug";
import { errorResponse } from "@/lib/http";
import { normalizeMapUrlInput } from "@/lib/location/maps";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { venue } = await requireEditableOwnVenue(id);
    const b = (await req.json()) as Record<string, unknown>;
    const data: Prisma.VenueUpdateInput = {};

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) throw new ValidationError("Venue name can't be empty");
      data.name = name;
      if (venue.status === "DRAFT") data.slug = await uniqueVenueSlug(name, venue.id);
    }
    if (b.city !== undefined) {
      const city = String(b.city).trim();
      if (!city) throw new ValidationError("City can't be empty");
      if (city === "Other") throw new ValidationError("Please choose or type a real city");
      data.city = city;
    }
    for (const k of ["description", "addressLine", "barangay", "contactNumber", "website", "houseRules"] as const) {
      if (b[k] !== undefined) data[k] = b[k] ? String(b[k]) : null;
    }
    if (b.amenities !== undefined) {
      data.amenities = Array.isArray(b.amenities) ? b.amenities.map(String) : [];
    }
    if (b.mapUrl !== undefined) {
      data.mapUrl = normalizeMapUrlInput(b.mapUrl);
    }

    const updated = await prisma.venue.update({ where: { id }, data, select: { slug: true } });
    return NextResponse.json({ ok: true, slug: updated.slug });
  } catch (e) {
    return errorResponse(e);
  }
}
