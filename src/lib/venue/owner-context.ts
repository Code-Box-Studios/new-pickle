import prisma from "@/lib/prisma";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import type { SessionUser } from "@/lib/auth/session";
import type { VenueStatus } from "@/generated/prisma";

export interface OwnerVenueRef {
  id: string;
  name: string;
  slug: string;
  status: VenueStatus;
  isPublished: boolean;
}

/** The venues an owner can manage + the currently-selected one (by ?venue= or first). */
export async function resolveOwnerVenues(session: SessionUser, venueParam?: string) {
  const ids = await accessibleVenueIds(session.id, session.role);
  const venues = await prisma.venue.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true, status: true, isPublished: true },
    orderBy: { name: "asc" },
  });
  const active = venues.find((v) => v.id === venueParam) ?? venues[0] ?? null;
  return { venues, active };
}
