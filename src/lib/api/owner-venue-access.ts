import prisma from "@/lib/prisma";
import { assertVenueAccess, requireUser } from "@/lib/auth/guards";
import { ConflictError, NotFoundError } from "@/lib/booking/errors";
import { assertVenueEditable } from "@/lib/venue/status";

/** Load a venue and assert the current user owns/staffs it (or is admin). */
export async function requireOwnVenue(id: string) {
  const session = await requireUser();
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) throw new NotFoundError("Venue not found");
  await assertVenueAccess(session.id, session.role, venue.id);
  return { session, venue };
}

/** Same, but also require the venue to be in an editable state (not under review). */
export async function requireEditableOwnVenue(id: string) {
  const res = await requireOwnVenue(id);
  assertVenueEditable(res.venue.status);
  return res;
}

/** Owner venue that is approved and thus operational (calendar, walk-ins, blocks). */
export async function requireOperationalOwnVenue(id: string) {
  const res = await requireOwnVenue(id);
  if (res.venue.status !== "APPROVED") {
    throw new ConflictError("This venue must be approved before you can manage day-to-day operations");
  }
  return res;
}
