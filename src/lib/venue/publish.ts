import prisma from "@/lib/prisma";
import { ConflictError, ValidationError } from "@/lib/booking/errors";
import { venueForCompleteness } from "./queries";
import { venueCompleteness } from "./completeness";

/** Go live. Re-checks approval AND completeness server-side (approval alone isn't enough). */
export async function publishVenue(venueId: string): Promise<void> {
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
  if (venue.status !== "APPROVED") {
    throw new ConflictError("Only approved venues can be published");
  }
  const c = venueCompleteness((await venueForCompleteness(venueId))!);
  if (!c.ok) {
    throw new ValidationError(`Can't publish yet — complete: ${c.missing.join(", ")}`);
  }
  await prisma.venue.update({ where: { id: venueId }, data: { isPublished: true } });
}

/** Take a venue offline (stays APPROVED, becomes dormant). */
export async function unpublishVenue(venueId: string): Promise<void> {
  await prisma.venue.update({ where: { id: venueId }, data: { isPublished: false } });
}
