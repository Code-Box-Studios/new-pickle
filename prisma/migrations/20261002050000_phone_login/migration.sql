ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "verifiedMobile" TEXT;
CREATE UNIQUE INDEX "users_verifiedMobile_key" ON "users"("verifiedMobile");
ALTER TABLE "users" ADD CONSTRAINT "users_login_identity_check"
  CHECK ("email" IS NOT NULL OR "verifiedMobile" IS NOT NULL);

CREATE TABLE "phone_challenges" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "clientKey" TEXT,
  "provider" TEXT NOT NULL,
  "providerSid" TEXT,
  "codeHash" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "phone_challenges_phone_createdAt_idx" ON "phone_challenges"("phone", "createdAt");
CREATE INDEX "phone_challenges_clientKey_createdAt_idx" ON "phone_challenges"("clientKey", "createdAt");
