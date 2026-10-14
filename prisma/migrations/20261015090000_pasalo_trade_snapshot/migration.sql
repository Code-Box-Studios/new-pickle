-- AlterTable
ALTER TABLE "pasalo_trades" ADD COLUMN "listingSnapshot" JSONB,
ADD COLUMN "paymentAccountName" TEXT,
ADD COLUMN "paymentAccountNumber" TEXT,
ADD COLUMN "paymentChannel" "PaymentChannel";

-- Archive each quote and receiving wallet independently of later relisting edits.
UPDATE "pasalo_trades" AS t SET
  "paymentAccountName" = l."paymentAccountName",
  "paymentAccountNumber" = l."paymentAccountNumber",
  "paymentChannel" = l."paymentChannel",
  "listingSnapshot" = jsonb_build_object(
    'id', l.id, 'venueName', l."venueName", 'venueSlug', l."venueSlug",
    'courtName', l."courtName", 'city', l.city,
    'startsAt', to_char(l."startsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(l."endsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'originalPriceCents', l."originalPriceCents", 'priceCents', t."priceCents",
    'note', l.note, 'status', l.status,
    'sellerName', COALESCE(NULLIF(split_part(trim(u.name), ' ', 1), ''), 'Player')
  )
FROM "pasalo_listings" AS l JOIN "users" AS u ON u.id = l."sellerId"
WHERE t."listingId" = l.id;

ALTER TABLE "pasalo_trades" ALTER COLUMN "listingSnapshot" SET NOT NULL,
ALTER COLUMN "paymentAccountName" SET NOT NULL,
ALTER COLUMN "paymentAccountNumber" SET NOT NULL,
ALTER COLUMN "paymentChannel" SET NOT NULL,
ADD CONSTRAINT "pasalo_trade_wallet_check" CHECK (
  "paymentChannel" IN ('GCASH', 'MAYA') AND
  char_length("paymentAccountName") BETWEEN 1 AND 100 AND
  "paymentAccountNumber" ~ '^\+639[0-9]{9}$'
);
