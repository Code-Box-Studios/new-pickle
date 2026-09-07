import prisma from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";

/** Find the venue that owns a media key (stored in `photos[]` as `/api/media/<key>`). */
export async function venueForMediaKey(key: string) {
  return prisma.venue.findFirst({
    where: { photos: { has: `/api/media/${key}` } },
    select: { id: true, ownerId: true, isPublished: true, status: true },
  });
}

/**
 * Media of a live (published + approved) venue is public. Otherwise only the
 * owner, its staff, or an admin may view it (preview). Authorization never
 * depends on the filename being secret.
 */
export async function canViewVenueMedia(
  venue: { id: string; ownerId: string; isPublished: boolean; status: string },
  session: SessionUser | null,
): Promise<boolean> {
  if (venue.isPublished && venue.status === "APPROVED") return true;
  if (!session) return false;
  if (session.role === "ADMIN" || session.id === venue.ownerId) return true;
  const staff = await prisma.venueStaff.findUnique({
    where: { venueId_userId: { venueId: venue.id, userId: session.id } },
  });
  return !!staff;
}
