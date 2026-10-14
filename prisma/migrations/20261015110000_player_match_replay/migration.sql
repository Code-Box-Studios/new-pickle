-- Preserve existing games and prevent a retried creation from recording a second game.
ALTER TABLE "player_matches"
  ADD COLUMN "submissionId" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "submissionHash" VARCHAR(64),
  ADD CONSTRAINT "player_match_submission_hash_check" CHECK ("submissionHash" IS NULL OR "submissionHash" ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX "player_matches_sessionId_createdById_submissionId_key"
  ON "player_matches"("sessionId", "createdById", "submissionId");
