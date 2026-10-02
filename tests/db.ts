import prisma from "@/lib/prisma";

export { prisma };

/** Wipe every table between tests. Explicit list keeps it deterministic. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "booking_status_history",
    "payment_submissions",
    "payment_methods",
    "bookings",
    "schedule_exceptions",
    "court_schedules",
    "courts",
    "reviews",
    "favorites",
    "notifications",
    "magic_link_tokens",
    "phone_challenges",
    "venue_staff",
    "venue_verifications",
    "sentry_connections",
    "venues",
    "users"
    RESTART IDENTITY CASCADE`);
}
