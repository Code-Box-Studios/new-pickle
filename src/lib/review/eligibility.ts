import prisma from "@/lib/prisma";

export type EligibilityReason = "NOT_FOUND" | "NOT_OWNER" | "NOT_COMPLETED" | "ALREADY_REVIEWED";

export interface EligibilityResult {
  eligible: boolean;
  reason?: EligibilityReason;
  venueId?: string;
  existingReview?: { id: string; rating: number; body: string | null } | null;
}

/** Server-authoritative check: booking exists, is owned by the user, is COMPLETED, not yet reviewed. */
export async function reviewEligibility(bookingId: string, userId: string): Promise<EligibilityResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, venueId: true, status: true },
  });
  if (!booking) return { eligible: false, reason: "NOT_FOUND" };
  if (booking.userId !== userId) return { eligible: false, reason: "NOT_OWNER" };

  const existingReview = await prisma.review.findUnique({
    where: { bookingId },
    select: { id: true, rating: true, body: true },
  });

  if (booking.status !== "COMPLETED") {
    return { eligible: false, reason: "NOT_COMPLETED", venueId: booking.venueId, existingReview };
  }
  if (existingReview) {
    return { eligible: false, reason: "ALREADY_REVIEWED", venueId: booking.venueId, existingReview };
  }
  return { eligible: true, venueId: booking.venueId, existingReview: null };
}

/** Public-safe author label. Never leak email/mobile — only a name or the email local-part. */
export function reviewerDisplayName(user: { name: string | null; email: string | null }): string {
  return user.name ?? user.email?.split("@")[0] ?? "RallyPoint player";
}
