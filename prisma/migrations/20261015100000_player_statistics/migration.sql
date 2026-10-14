-- CreateEnum
CREATE TYPE "PlayerSkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PlayerAttendance" AS ENUM ('UNKNOWN', 'ATTENDED', 'ABSENT');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "PlayerInvitationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PlayerMatchFormat" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "PlayerMatchWinner" AS ENUM ('A', 'B', 'UNFINISHED');

-- CreateEnum
CREATE TYPE "PlayerMatchTeam" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "PlayerMatchDecision" AS ENUM ('CONFIRMED', 'DISPUTED');

-- CreateTable
CREATE TABLE "player_profiles" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "skillLevel" "PlayerSkillLevel",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT,
    "nickname" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "attendance" "PlayerAttendance" NOT NULL DEFAULT 'UNKNOWN',
    "attendanceAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_invitations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "respondedById" TEXT,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "status" "PlayerInvitationStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_sessions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "play_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_matches" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_revisions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "format" "PlayerMatchFormat" NOT NULL,
    "winner" "PlayerMatchWinner" NOT NULL,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "note" TEXT,
    "authoredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_match_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_members" (
    "revisionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "team" "PlayerMatchTeam" NOT NULL,

    CONSTRAINT "player_match_members_pkey" PRIMARY KEY ("revisionId","participantId")
);

-- CreateTable
CREATE TABLE "player_match_votes" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "PlayerMatchDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_match_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_audits" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_participants_userId_status_attendance_idx" ON "booking_participants"("userId", "status", "attendance");

-- CreateIndex
CREATE UNIQUE INDEX "booking_participants_bookingId_userId_key" ON "booking_participants"("bookingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_invitations_tokenHash_key" ON "player_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "player_invitations_bookingId_status_expiresAt_idx" ON "player_invitations"("bookingId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "player_invitations_createdById_idx" ON "player_invitations"("createdById");

-- CreateIndex
CREATE INDEX "player_invitations_respondedById_idx" ON "player_invitations"("respondedById");

-- CreateIndex
CREATE UNIQUE INDEX "play_sessions_bookingId_key" ON "play_sessions"("bookingId");

-- CreateIndex
CREATE INDEX "player_matches_sessionId_createdAt_idx" ON "player_matches"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "player_matches_createdById_idx" ON "player_matches"("createdById");

-- CreateIndex
CREATE INDEX "player_match_revisions_authoredById_idx" ON "player_match_revisions"("authoredById");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_revisions_matchId_number_key" ON "player_match_revisions"("matchId", "number");

-- CreateIndex
CREATE INDEX "player_match_members_participantId_idx" ON "player_match_members"("participantId");

-- CreateIndex
CREATE INDEX "player_match_votes_userId_createdAt_idx" ON "player_match_votes"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_votes_revisionId_userId_decision_key" ON "player_match_votes"("revisionId", "userId", "decision");

-- CreateIndex
CREATE INDEX "player_audits_actorId_createdAt_idx" ON "player_audits"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "player_audits_bookingId_createdAt_idx" ON "player_audits"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_matches" ADD CONSTRAINT "player_matches_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "play_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_matches" ADD CONSTRAINT "player_matches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_revisions" ADD CONSTRAINT "player_match_revisions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "player_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_revisions" ADD CONSTRAINT "player_match_revisions_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_members" ADD CONSTRAINT "player_match_members_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "player_match_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_members" ADD CONSTRAINT "player_match_members_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "booking_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_votes" ADD CONSTRAINT "player_match_votes_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "player_match_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_votes" ADD CONSTRAINT "player_match_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_audits" ADD CONSTRAINT "player_audits_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_audits" ADD CONSTRAINT "player_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "player_invitations" ADD COLUMN "startsAt" TIMESTAMP(3) NOT NULL, ADD COLUMN "endsAt" TIMESTAMP(3) NOT NULL;
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profile_name_check" CHECK (char_length("displayName") BETWEEN 1 AND 60);
ALTER TABLE "booking_participants" ADD CONSTRAINT "player_nickname_check" CHECK (char_length("nickname") BETWEEN 1 AND 60),
  ADD CONSTRAINT "player_left_check" CHECK ("status" = 'ACTIVE' OR "leftAt" IS NOT NULL),
  ADD CONSTRAINT "player_attendance_check" CHECK ("attendance" = 'UNKNOWN' OR "attendanceAt" IS NOT NULL);
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invite_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "player_invite_label_check" CHECK (char_length("label") <= 60);
ALTER TABLE "player_matches" ADD CONSTRAINT "player_match_revision_check" CHECK ("currentRevision" > 0);
ALTER TABLE "player_match_revisions" ADD CONSTRAINT "player_revision_number_check" CHECK ("number" > 0),
  ADD CONSTRAINT "player_revision_note_check" CHECK (char_length("note") <= 200),
  ADD CONSTRAINT "player_revision_scores_check" CHECK (("scoreA" IS NULL) = ("scoreB" IS NULL) AND
    ("scoreA" IS NULL OR ("scoreA" BETWEEN 0 AND 999 AND "scoreB" BETWEEN 0 AND 999 AND
    ("winner" = 'UNFINISHED' OR ("winner" = 'A' AND "scoreA" > "scoreB") OR ("winner" = 'B' AND "scoreB" > "scoreA")))));
ALTER TABLE "player_audits" ADD CONSTRAINT "player_audit_action_check" CHECK (char_length("action") BETWEEN 1 AND 80);

-- Private application data. No browser policies or exposed credential lookup functions.
ALTER TABLE "player_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_profiles" FROM PUBLIC;
ALTER TABLE "booking_participants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "booking_participants" FROM PUBLIC;
ALTER TABLE "player_invitations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_invitations" FROM PUBLIC;
ALTER TABLE "play_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "play_sessions" FROM PUBLIC;
ALTER TABLE "player_matches" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_matches" FROM PUBLIC;
ALTER TABLE "player_match_revisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_match_revisions" FROM PUBLIC;
ALTER TABLE "player_match_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_match_members" FROM PUBLIC;
ALTER TABLE "player_match_votes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_match_votes" FROM PUBLIC;
ALTER TABLE "player_audits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "player_audits" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "player_profiles", "booking_participants", "player_invitations", "play_sessions", "player_matches", "player_match_revisions", "player_match_members", "player_match_votes", "player_audits" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "player_profiles", "booking_participants", "player_invitations", "play_sessions", "player_matches", "player_match_revisions", "player_match_members", "player_match_votes", "player_audits" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pikol_server') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "player_profiles", "booking_participants", "player_invitations", "play_sessions", "player_matches", "player_match_revisions", "player_match_members", "player_match_votes", "player_audits" TO pikol_server;
    CREATE POLICY pikol_server_access ON "player_profiles" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "booking_participants" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_invitations" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "play_sessions" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_matches" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_match_revisions" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_match_members" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_match_votes" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "player_audits" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
  END IF;
END $$;
