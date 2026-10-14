-- CreateEnum
CREATE TYPE "PasaloListingStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PasaloTradeStatus" AS ENUM ('RESERVED', 'PAYMENT_SENT', 'TRANSFERRED', 'RELEASED', 'EXPIRED', 'VOIDED');

-- CreateTable
CREATE TABLE "pasalo_listings" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "originalReference" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueSlug" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "originalPriceCents" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "note" TEXT,
    "paymentChannel" "PaymentChannel" NOT NULL,
    "paymentAccountName" TEXT NOT NULL,
    "paymentAccountNumber" TEXT NOT NULL,
    "status" "PasaloListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasalo_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasalo_trades" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "customerEmail" TEXT,
    "status" "PasaloTradeStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentSentAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pasalo_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasalo_messages" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasalo_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pasalo_listings_bookingId_key" ON "pasalo_listings"("bookingId");

-- CreateIndex
CREATE INDEX "pasalo_listings_status_startsAt_idx" ON "pasalo_listings"("status", "startsAt");

-- CreateIndex
CREATE INDEX "pasalo_listings_city_status_startsAt_idx" ON "pasalo_listings"("city", "status", "startsAt");

-- CreateIndex
CREATE INDEX "pasalo_listings_sellerId_createdAt_idx" ON "pasalo_listings"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "pasalo_trades_listingId_status_idx" ON "pasalo_trades"("listingId", "status");

-- CreateIndex
CREATE INDEX "pasalo_trades_buyerId_createdAt_idx" ON "pasalo_trades"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "pasalo_messages_tradeId_createdAt_id_idx" ON "pasalo_messages"("tradeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "pasalo_messages_senderId_createdAt_idx" ON "pasalo_messages"("senderId", "createdAt");

-- AddForeignKey
ALTER TABLE "pasalo_listings" ADD CONSTRAINT "pasalo_listings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasalo_listings" ADD CONSTRAINT "pasalo_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasalo_trades" ADD CONSTRAINT "pasalo_trades_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "pasalo_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasalo_trades" ADD CONSTRAINT "pasalo_trades_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasalo_messages" ADD CONSTRAINT "pasalo_messages_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "pasalo_trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasalo_messages" ADD CONSTRAINT "pasalo_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A listing can have only one unresolved buyer, even across application instances.
CREATE UNIQUE INDEX "pasalo_trade_one_active_buyer" ON "pasalo_trades" ("listingId")
  WHERE "status" IN ('RESERVED', 'PAYMENT_SENT');
ALTER TABLE "pasalo_listings"
  ADD CONSTRAINT "pasalo_price_check" CHECK ("priceCents" > 0 AND "priceCents" < "originalPriceCents"),
  ADD CONSTRAINT "pasalo_channel_check" CHECK ("paymentChannel" IN ('GCASH', 'MAYA')),
  ADD CONSTRAINT "pasalo_window_check" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "pasalo_note_check" CHECK (char_length("note") <= 500),
  ADD CONSTRAINT "pasalo_account_check" CHECK (char_length("paymentAccountName") BETWEEN 1 AND 100 AND "paymentAccountNumber" ~ '^\+639[0-9]{9}$');
ALTER TABLE "pasalo_trades"
  ADD CONSTRAINT "pasalo_trade_price_check" CHECK ("priceCents" > 0),
  ADD CONSTRAINT "pasalo_trade_contact_check" CHECK (char_length("customerName") BETWEEN 1 AND 100 AND "customerMobile" ~ '^\+639[0-9]{9}$'),
  ADD CONSTRAINT "pasalo_trade_reference_check" CHECK (char_length("paymentReference") <= 100);
ALTER TABLE "pasalo_messages"
  ADD CONSTRAINT "pasalo_message_body_check" CHECK (char_length("body") BETWEEN 1 AND 1000);

-- Wallet details and chat are served only by authorized server routes.
ALTER TABLE "pasalo_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pasalo_trades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pasalo_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "pasalo_listings", "pasalo_trades", "pasalo_messages" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "pasalo_listings", "pasalo_trades", "pasalo_messages" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "pasalo_listings", "pasalo_trades", "pasalo_messages" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pikol_server') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "pasalo_listings", "pasalo_trades", "pasalo_messages" TO pikol_server;
    CREATE POLICY pikol_server_access ON "pasalo_listings" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "pasalo_trades" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
    CREATE POLICY pikol_server_access ON "pasalo_messages" FOR ALL TO pikol_server USING (true) WITH CHECK (true);
  END IF;
END $$;
