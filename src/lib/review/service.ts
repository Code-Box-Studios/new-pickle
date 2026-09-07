import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from "@/lib/booking/errors";
import { reviewerDisplayName } from "./eligibility";

const MAX_BODY = 1000;

type Tx = Prisma.TransactionClient;

function validate(rating: unknown, body: unknown): { rating: number; body: string | null } {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError("Rating must be a whole number from 1 to 5");
  }
  let clean: string | null = null;
  if (typeof body === "string") {
    const t = body.trim();
    if (t.length > MAX_BODY) throw new ValidationError(`Keep your review under ${MAX_BODY} characters`);
    clean = t.length ? t : null;
  } else if (body != null) {
    throw new ValidationError("Invalid review text");
  }
  return { rating, body: clean };
}

/** Recompute the denormalized venue aggregate inside the write transaction. */
async function recomputeVenueRating(tx: Tx, venueId: string): Promise<void> {
  const agg = await tx.review.aggregate({ where: { venueId }, _avg: { rating: true }, _count: true });
  const avg = agg._avg.rating ?? 0;
  await tx.venue.update({
    where: { id: venueId },
    data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: agg._count },
  });
}

const REVIEW_SELECT = { id: true, rating: true, body: true, createdAt: true, updatedAt: true } as const;

export interface CreateReviewInput {
  bookingId: string;
  userId: string;
  rating: number;
  body?: string | null;
}

export async function createReview(input: CreateReviewInput) {
  const { rating, body } = validate(input.rating, input.body);
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, userId: true, venueId: true, status: true },
      });
      if (!booking) throw new NotFoundError("Booking not found");
      if (booking.userId !== input.userId) throw new ForbiddenError();
      if (booking.status !== "COMPLETED") {
        throw new ConflictError("You can review only after your booking is completed");
      }

      const existing = await tx.review.findUnique({ where: { bookingId: input.bookingId }, select: { id: true } });
      if (existing) throw new ConflictError("You already reviewed this booking");

      const review = await tx.review.create({
        data: { bookingId: booking.id, venueId: booking.venueId, userId: input.userId, rating, body },
        select: REVIEW_SELECT,
      });
      await recomputeVenueRating(tx, booking.venueId);
      return review;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError("You already reviewed this booking");
    }
    throw e;
  }
}

export interface UpdateReviewInput {
  bookingId: string;
  userId: string;
  rating: number;
  body?: string | null;
}

export async function updateReview(input: UpdateReviewInput) {
  const { rating, body } = validate(input.rating, input.body);
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, userId: true, venueId: true },
    });
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.userId !== input.userId) throw new ForbiddenError();

    const review = await tx.review.findUnique({
      where: { bookingId: input.bookingId },
      select: { id: true, userId: true },
    });
    if (!review) throw new NotFoundError("Review not found");
    if (review.userId !== input.userId) throw new ForbiddenError();

    const updated = await tx.review.update({ where: { id: review.id }, data: { rating, body }, select: REVIEW_SELECT });
    await recomputeVenueRating(tx, booking.venueId);
    return updated;
  });
}

export interface RatingSummary {
  avg: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export async function venueRatingSummary(venueId: string): Promise<RatingSummary> {
  const groups = await prisma.review.groupBy({ by: ["rating"], where: { venueId }, _count: true });
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const g of groups) {
    const r = g.rating as 1 | 2 | 3 | 4 | 5;
    distribution[r] = g._count;
    total += g._count;
    sum += g.rating * g._count;
  }
  return { avg: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution };
}

export async function listVenueReviews(venueId: string, take = 6) {
  const rows = await prisma.review.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, body: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt,
    authorName: reviewerDisplayName(r.user),
  }));
}

export async function listReviewsForVenues(venueIds: string[], take = 50) {
  if (venueIds.length === 0) return [];
  const rows = await prisma.review.findMany({
    where: { venueId: { in: venueIds } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      venueId: true,
      venue: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt,
    venueId: r.venueId,
    venueName: r.venue.name,
    authorName: reviewerDisplayName(r.user),
  }));
}
