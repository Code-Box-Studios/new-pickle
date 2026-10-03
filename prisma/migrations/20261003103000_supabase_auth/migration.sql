ALTER TABLE "users" ADD COLUMN "supabaseId" TEXT;
CREATE UNIQUE INDEX "users_supabaseId_key" ON "users"("supabaseId");

-- Auth and application data are accessed by the trusted Pikol server.
-- No anon/authenticated policies: browser Data API requests must see no rows.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'magic_link_tokens', 'phone_challenges', 'venues', 'venue_staff',
    'courts', 'court_schedules', 'schedule_exceptions', 'bookings',
    'payment_submissions', 'payment_methods', 'booking_status_history',
    'reviews', 'favorites', 'notifications', 'venue_verifications', 'sentry_connections'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;
