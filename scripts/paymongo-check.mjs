import { PrismaClient } from "../src/generated/prisma/index.js";
import {
  appOrigin,
  merchantByAlias,
} from "../src/lib/payments/paymongo/config.ts";

const activation = process.argv.includes("--activation");
const enabled = process.env.PAYMONGO_ENABLED === "true",
  ready = process.env.PAYMONGO_LEDGER_READY === "true";
if (!activation && !enabled && !ready) {
  console.log(
    "PayMongo DISABLED — legacy venue payments remain available; no payment provider requests.",
  );
  console.log(
    "Run npm run payments:check -- --activation after adding merchant configuration and applying the migration.",
  );
} else {
  const db = new PrismaClient();
  try {
    const entries = JSON.parse(process.env.PAYMONGO_MERCHANTS || "[]");
    if (!Array.isArray(entries) || !entries.length) throw new Error();
    if (
      process.env.APP_PREVIEW_MODE === "true" ||
      !process.env.CRON_SECRET ||
      process.env.CRON_SECRET.length < 32
    )
      throw new Error();
    const origin = appOrigin();
    // This process performs reads only. Validate credentials even before toggling the rollout flag.
    process.env.PAYMONGO_LEDGER_READY = "true";
    const merchants = entries.map((entry) =>
      merchantByAlias(entry.alias, process.env.PAYMONGO_MODE),
    );
    const tables =
      await db.$queryRaw`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('payment_checkouts','payment_webhook_receipts')`;
    if (tables.length !== 2 || tables.some((table) => !table.relrowsecurity))
      throw new Error();
    const columns =
      await db.$queryRaw`SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'proofKey'`;
    if (columns[0]?.is_nullable !== "YES") throw new Error();
    const enumValues =
      await db.$queryRaw`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'PaymentChannel' AND enumlabel = 'QRPH'`;
    if (!enumValues.length) throw new Error();
    const exposedPolicies =
      await db.$queryRaw`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('payment_checkouts','payment_webhook_receipts') AND roles && ARRAY['public','anon','authenticated']::name[]`;
    if (exposedPolicies.length) throw new Error();
    const publicGrants =
      await db.$queryRaw`SELECT grantee FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('payment_checkouts','payment_webhook_receipts') AND grantee IN ('PUBLIC','anon','authenticated')`;
    if (publicGrants.length) throw new Error();
    const privileges =
      await db.$queryRaw`SELECT NOT EXISTS (SELECT 1 FROM (VALUES ('public.payment_checkouts'), ('public.payment_webhook_receipts')) AS t(name) CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilege) WHERE NOT has_table_privilege(current_user, t.name, p.privilege)) AS allowed`;
    if (!privileges[0]?.allowed) throw new Error();
    // Empty SELECTs cannot prove RLS permits writes. Require the migration's trusted ALL policy
    // (or an effective table owner/BYPASSRLS role), with no restrictive policy blocking it.
    const runtimeAccess = await db.$queryRaw`
      SELECT bool_and(
        r.rolsuper OR r.rolbypassrls OR
        (NOT c.relforcerowsecurity AND pg_has_role(current_user, c.relowner, 'USAGE')) OR
        (EXISTS (
          SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd = '*'
          AND pg_get_expr(p.polqual, c.oid) = 'true'
          AND COALESCE(pg_get_expr(p.polwithcheck, c.oid), pg_get_expr(p.polqual, c.oid)) = 'true'
          AND EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.oid = ANY(p.polroles) AND pg_has_role(current_user, pr.oid, 'USAGE'))
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND NOT p.polpermissive
          AND (0 = ANY(p.polroles) OR EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.oid = ANY(p.polroles) AND pg_has_role(current_user, pr.oid, 'USAGE')))
        ))
      ) AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN pg_roles r
      WHERE n.nspname = 'public' AND c.relname IN ('payment_checkouts','payment_webhook_receipts') AND r.rolname = current_user`;
    if (!runtimeAccess[0]?.allowed) throw new Error();
    await db.paymentCheckout.findFirst({ select: { id: true } });
    await db.paymentWebhookReceipt.findFirst({ select: { id: true } });
    for (const merchant of merchants) {
      const venues = await db.venue.findMany({
        where: { id: { in: [...merchant.venueIds] } },
        select: { id: true, ownerId: true, status: true, isPublished: true },
      });
      if (
        venues.length !== merchant.venueIds.length ||
        venues.some(
          (v) =>
            v.ownerId !== merchant.ownerId ||
            v.status !== "APPROVED" ||
            !v.isPublished,
        )
      )
        throw new Error();
      console.log(
        `Merchant ${merchant.alias}: ${merchant.mode}; ${venues.length} approved venue(s); ${merchant.methods.join(", ")}`,
      );
      console.log(
        `Webhook: ${origin}/api/webhooks/paymongo/${merchant.alias}/${merchant.mode}`,
      );
    }
    console.log(
      `Configuration and database checks passed (${enabled ? "creation enabled" : "creation DISABLED"}).`,
    );
    console.log(
      "No payment provider requests. Merchant verification, enabled channels, webhook registration and sandbox acceptance must still be checked in PayMongo.",
    );
  } catch {
    console.error(
      "PayMongo not ready. Check merchant mappings, mode/key prefixes, APP_URL, CRON_SECRET, database migration, private RLS and runtime permissions. Credentials are never printed.",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
