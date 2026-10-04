-- CreateEnum
CREATE TYPE "PaymentCheckoutStatus" AS ENUM ('CREATING', 'PENDING', 'PAID', 'REVIEW', 'FAILED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PaymentChannel" ADD VALUE 'QRPH';

-- AlterTable
ALTER TABLE "payment_submissions" ALTER COLUMN "proofKey" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_checkouts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "merchantAlias" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "recipientOwnerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "PaymentCheckoutStatus" NOT NULL DEFAULT 'CREATING',
    "sessionId" TEXT,
    "checkoutUrl" TEXT,
    "paymentId" TEXT,
    "reviewReason" TEXT,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_receipts" (
    "id" TEXT NOT NULL,
    "merchantAlias" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "checkoutId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "outcome" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_checkouts_bookingId_key" ON "payment_checkouts"("bookingId");

-- CreateIndex
CREATE INDEX "payment_checkouts_status_holdExpiresAt_idx" ON "payment_checkouts"("status", "holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_checkouts_merchantAlias_mode_sessionId_key" ON "payment_checkouts"("merchantAlias", "mode", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_checkouts_merchantAlias_mode_paymentId_key" ON "payment_checkouts"("merchantAlias", "mode", "paymentId");

-- CreateIndex
CREATE INDEX "payment_webhook_receipts_checkoutId_idx" ON "payment_webhook_receipts"("checkoutId");

-- CreateIndex
CREATE INDEX "payment_webhook_receipts_merchantAlias_mode_paymentId_idx" ON "payment_webhook_receipts"("merchantAlias", "mode", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_receipts_merchantAlias_mode_eventId_key" ON "payment_webhook_receipts"("merchantAlias", "mode", "eventId");

-- AddForeignKey
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_receipts" ADD CONSTRAINT "payment_webhook_receipts_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "payment_checkouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger invariants and private access. No browser/anonymous policies.
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_mode_check" CHECK ("mode" IN ('test', 'live')),
  ADD CONSTRAINT "payment_checkouts_amount_check" CHECK ("amountCents" > 0 AND "currency" = 'PHP');
ALTER TABLE "payment_webhook_receipts" ADD CONSTRAINT "payment_receipts_mode_check" CHECK ("mode" IN ('test', 'live')),
  ADD CONSTRAINT "payment_receipts_amount_check" CHECK ("amountCents" > 0);
ALTER TABLE "payment_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_webhook_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "payment_checkouts", "payment_webhook_receipts" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "payment_checkouts", "payment_webhook_receipts" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "payment_checkouts", "payment_webhook_receipts" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pikol_server') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_checkouts", "payment_webhook_receipts" TO pikol_server;
    CREATE POLICY pikol_server_access ON "payment_checkouts" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "payment_webhook_receipts" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
  END IF;
END $$;
