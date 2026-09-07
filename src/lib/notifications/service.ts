import prisma from "@/lib/prisma";
import { dateLabel, timeLabel } from "@/lib/format";
import { notificationDelivery } from "./delivery";
import { NotificationType } from "./types";

interface CreateInput {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  bookingId?: string | null;
}

async function create(input: CreateInput) {
  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      bookingId: input.bookingId ?? null,
    },
  });
  try {
    await notificationDelivery.deliver(input);
  } catch (e) {
    console.error("[notify] delivery failed", e);
  }
  return n;
}

/** Create only if no matching (userId, type, bookingId) notification exists. */
async function createOnce(input: CreateInput & { bookingId: string }) {
  const existing = await prisma.notification.findFirst({
    where: { userId: input.userId, type: input.type, bookingId: input.bookingId },
  });
  if (existing) return existing;
  return create(input);
}

// ---- read state (all scoped to a userId) ----

function listForUser(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function markRead(userId: string, id: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

async function markAllRead(userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

// ---- event helpers ----

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      venue: { select: { name: true, ownerId: true, staff: { select: { userId: true } } } },
      court: { select: { name: true } },
    },
  });
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function ownerRecipients(venue: LoadedBooking["venue"]): string[] {
  return Array.from(new Set([venue.ownerId, ...venue.staff.map((s) => s.userId)]));
}
const playerLink = (ref: string) => `/bookings/${ref}`;
const ownerLink = (ref: string) => `/owner/reservations/${ref}`;
const whenLabel = (b: LoadedBooking) => `${dateLabel(b.startsAt)} ${timeLabel(b.startsAt)}`;

async function onBookingCreated(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || !b.userId) return;
  await createOnce({
    userId: b.userId,
    type: NotificationType.BOOKING_CREATED,
    title: "Booking started",
    body: `${b.venue.name} · ${b.court.name} · ${whenLabel(b)}`,
    link: playerLink(b.reference),
    bookingId,
  });
}

async function onPaymentSubmitted(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  if (b.userId) {
    await create({
      userId: b.userId,
      type: NotificationType.PAYMENT_SUBMITTED,
      title: "Payment submitted",
      body: `We sent your payment to ${b.venue.name} for confirmation.`,
      link: playerLink(b.reference),
      bookingId,
    });
  }
  for (const uid of ownerRecipients(b.venue)) {
    await create({
      userId: uid,
      type: NotificationType.NEW_RESERVATION,
      title: "New reservation to confirm",
      body: `${b.customerName ?? "A player"} · ${b.court.name} · ${whenLabel(b)}`,
      link: ownerLink(b.reference),
      bookingId,
    });
  }
}

async function onConfirmed(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || !b.userId) return;
  await create({
    userId: b.userId,
    type: NotificationType.BOOKING_CONFIRMED,
    title: "Booking confirmed 🎉",
    body: `${b.venue.name} confirmed your booking for ${whenLabel(b)}.`,
    link: playerLink(b.reference),
    bookingId,
  });
}

async function onRejected(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || !b.userId) return;
  await create({
    userId: b.userId,
    type: NotificationType.BOOKING_REJECTED,
    title: "Booking not confirmed",
    body: `${b.venue.name} couldn't confirm your booking for ${whenLabel(b)}.`,
    link: playerLink(b.reference),
    bookingId,
  });
}

async function onCancelled(bookingId: string, byActorType: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  if (byActorType === "CUSTOMER") {
    // Customer cancelled → tell the venue.
    for (const uid of ownerRecipients(b.venue)) {
      await create({
        userId: uid,
        type: NotificationType.CUSTOMER_CANCELLED,
        title: "Customer cancelled",
        body: `${b.customerName ?? "A player"} cancelled ${b.court.name} · ${whenLabel(b)}.`,
        link: ownerLink(b.reference),
        bookingId,
      });
    }
  } else if (b.userId) {
    // Venue/admin cancelled → tell the customer.
    await create({
      userId: b.userId,
      type: NotificationType.BOOKING_CANCELLED,
      title: "Booking cancelled",
      body: `Your booking at ${b.venue.name} for ${whenLabel(b)} was cancelled.`,
      link: playerLink(b.reference),
      bookingId,
    });
  }
}

async function onExpired(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b || !b.userId) return;
  await create({
    userId: b.userId,
    type: NotificationType.BOOKING_EXPIRED,
    title: "Hold expired",
    body: `Your hold at ${b.venue.name} for ${whenLabel(b)} expired.`,
    link: playerLink(b.reference),
    bookingId,
  });
}

/** Create deduped reminders for CONFIRMED bookings starting within the window. */
async function sweepUpcomingReminders(now = new Date(), withinMinutes = 120): Promise<number> {
  const to = new Date(now.getTime() + withinMinutes * 60_000);
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: now, lt: to } },
    include: {
      venue: { select: { name: true, ownerId: true, staff: { select: { userId: true } } } },
      court: { select: { name: true } },
    },
  });
  for (const b of bookings) {
    if (b.userId) {
      await createOnce({
        userId: b.userId,
        type: NotificationType.BOOKING_REMINDER,
        title: "Upcoming booking",
        body: `${b.venue.name} · ${b.court.name} at ${timeLabel(b.startsAt)}`,
        link: playerLink(b.reference),
        bookingId: b.id,
      });
    }
    for (const uid of ownerRecipients(b.venue)) {
      await createOnce({
        userId: uid,
        type: NotificationType.BOOKING_REMINDER,
        title: "Upcoming booking",
        body: `${b.customerName ?? "Player"} · ${b.court.name} at ${timeLabel(b.startsAt)}`,
        link: ownerLink(b.reference),
        bookingId: b.id,
      });
    }
  }
  return bookings.length;
}

export const notificationService = {
  create,
  createOnce,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  onBookingCreated,
  onPaymentSubmitted,
  onConfirmed,
  onRejected,
  onCancelled,
  onExpired,
  sweepUpcomingReminders,
};
