import prisma from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/booking/errors";
import { getSession, type SessionUser } from "./session";

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const s = await requireUser();
  if (s.role !== "ADMIN" && !roles.includes(s.role)) throw new ForbiddenError();
  return s;
}

/**
 * A user may act on a venue if they are ADMIN, its owner, or its staff.
 * Throws ForbiddenError otherwise. Used by every owner-side mutation.
 */
export async function assertVenueAccess(
  userId: string,
  role: Role,
  venueId: string,
): Promise<void> {
  if (role === "ADMIN") return;
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { ownerId: true },
  });
  if (!venue) throw new ForbiddenError();
  if (venue.ownerId === userId) return;
  const staff = await prisma.venueStaff.findUnique({
    where: { venueId_userId: { venueId, userId } },
  });
  if (staff) return;
  throw new ForbiddenError("You don't manage this venue");
}
