-- Optional daily hourly bands. Existing courts retain their flat rate.
-- The courts table already has RLS; this column inherits its access controls.
ALTER TABLE "courts" ADD COLUMN "timeRates" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "courts" ADD CONSTRAINT "courts_time_rates_array"
  CHECK (jsonb_typeof("timeRates") = 'array' AND jsonb_array_length("timeRates") <= 4);
