# Migrations

## Applying migrations

Use **`prisma migrate deploy`** (`npm run db:deploy`) to apply committed
migrations. This is what the app, the seed, and the test harness use.

**Do not use `prisma migrate dev`** on this project without care. The `bookings`
table has a DB-generated `period` column and a GiST `EXCLUDE` constraint
(`bookings_no_overlap`) added by raw SQL in `*_booking_exclusion`. Prisma 5
cannot model generated columns, so `migrate dev` reports **benign drift** on
`period` (it tries to `DROP DEFAULT`, which would strip the generation
expression). That drift is expected and must not be applied.

If you need to add future schema changes, generate the migration with
`prisma migrate dev --create-only`, then **manually delete** any
`ALTER COLUMN "period" DROP DEFAULT` / `DROP COLUMN "period"` lines before
applying with `migrate deploy`.

## The double-booking guarantee

`*_booking_exclusion/migration.sql`:

- `CREATE EXTENSION btree_gist`
- `bookings.period` = `tsrange(startsAt, endsAt, '[)')` (generated, stored)
- `EXCLUDE USING gist (courtId WITH =, period WITH &&)` `WHERE status IN`
  (`HELD, PENDING_PAYMENT, PAYMENT_SUBMITTED, PENDING_CONFIRMATION, CONFIRMED`)

Two overlapping bookings on the same court in any occupying status are rejected
by the database with SQLSTATE `23P01`, which the app maps to HTTP 409.
