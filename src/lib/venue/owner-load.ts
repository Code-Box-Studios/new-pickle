import prisma from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { cache } from "react";

/** Load a venue with wizard relations, access-checked for owner/staff/admin. */
// The venue, verified user ID, and live role all participate in this
// render-scoped cache. Every new request repeats the ownership checks.
export const loadOwnerVenue = cache(async (id: string, userId: string, role: Role) => {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      courts: { orderBy: { sortOrder: "asc" }, include: { schedules: true } },
      paymentMethods: { orderBy: { sortOrder: "asc" } },
      verification: true,
    },
  });
  if (!venue) return null;
  if (venue.ownerId === userId || role === "ADMIN") return venue;
  const staff = await prisma.venueStaff.findUnique({
    where: { venueId_userId: { venueId: id, userId } },
  });
  return staff ? venue : null;
});

export type OwnerVenue = NonNullable<Awaited<ReturnType<typeof loadOwnerVenue>>>;

/** Per-step completion for the wizard rail + Review gate. */
export function wizardProgress(v: OwnerVenue) {
  const active = v.courts.filter((c) => c.active);
  const done = {
    details: !!(v.name && v.city),
    photos: v.photos.length > 0,
    courts: active.length > 0 && active.every((c) => c.priceCents > 0),
    hours: active.length > 0 && active.every((c) => c.schedules.length > 0),
    payments: v.paymentMethods.some((p) => p.active),
    review: false,
  };
  done.review = done.details && done.photos && done.courts && done.hours && done.payments;
  return done;
}
