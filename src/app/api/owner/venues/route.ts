import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { promoteToOwner } from "@/lib/auth/promote";
import { uniqueVenueSlug } from "@/lib/venue/slug";
import { errorResponse } from "@/lib/http";

/** Create a DRAFT venue, promote the creator to OWNER, and read the new role on subsequent requests. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "").trim() || "My venue";
    const slug = await uniqueVenueSlug(name);

    const venue = await prisma.venue.create({
      data: {
        name,
        slug,
        city: "Davao City",
        status: "DRAFT",
        isPublished: false,
        ownerId: session.id,
        photos: [],
        amenities: [],
      },
      select: { id: true },
    });

    await promoteToOwner(session.id);
    return NextResponse.json({ id: venue.id });
  } catch (e) {
    return errorResponse(e);
  }
}
