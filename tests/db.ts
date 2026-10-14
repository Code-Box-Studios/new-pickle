import prisma from "@/lib/prisma";

export { prisma };

/** Wipe every table between tests. Explicit list keeps it deterministic. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "player_audits",
    "player_match_votes",
    "player_match_members",
    "player_match_revisions",
    "player_matches",
    "play_sessions",
    "player_invitations",
    "booking_participants",
    "player_profiles",
    "pasalo_messages",
    "pasalo_trades",
    "pasalo_listings",
    "payment_webhook_receipts",
    "payment_checkouts",
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
