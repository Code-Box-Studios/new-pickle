import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt } from "../factories";

const env = {
  ...process.env,
  PAYMONGO_ENABLED: "false",
  PAYMONGO_LEDGER_READY: "false",
  PAYMONGO_MODE: "test",
  PAYMONGO_MERCHANTS: "[]",
  PAYMONGO_SECRET_KEY: "",
  PAYMONGO_WEBHOOK_SECRET: "",
};
const args = [
  "--conditions=react-server",
  "--import",
  "tsx",
  "scripts/paymongo-check.mjs",
];
describe("payment activation readiness", () => {
  it("reports a safe disabled deployment without needing private keys or contacting a provider", () => {
    const out = execFileSync(process.execPath, args, { env, encoding: "utf8" });
    expect(out).toContain("DISABLED");
    expect(out).toContain("no payment provider requests");
  });
  it("fails activation checks when merchant credentials or mappings are absent", () => {
    const result = spawnSync(process.execPath, [...args, "--activation"], {
      env,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toContain("not ready");
    expect(result.stderr + result.stdout).not.toContain("postgresql://");
  });
  it("requires a usable private runtime RLS policy, not just empty SELECT results", async () => {
    await resetDb();
    const venue = await seedOwnerVenueCourt();
    const role = `pikol_readiness_${randomUUID().replaceAll("-", "")}`;
    const password = randomUUID();
    const runtimeUrl = new URL(process.env.DATABASE_URL!);
    runtimeUrl.username = role;
    runtimeUrl.password = password;
    const configured = {
      ...env,
      DATABASE_URL: runtimeUrl.toString(),
      DIRECT_URL: runtimeUrl.toString(),
      APP_PREVIEW_MODE: "false",
      APP_URL: "http://localhost:3000",
      CRON_SECRET: "test-cron-secret-with-more-than-32-chars",
      PAYMONGO_SECRET_KEY: "sk_test_dummy",
      PAYMONGO_WEBHOOK_SECRET: "whsk_dummy",
      PAYMONGO_MERCHANTS: JSON.stringify([
        { alias: "default", ownerId: venue.ownerId, venueIds: [venue.venueId] },
      ]),
    };
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOBYPASSRLS`,
    );
    try {
      await prisma.$executeRawUnsafe(
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
      );
      await prisma.$executeRawUnsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_checkouts, public.payment_webhook_receipts TO "${role}"`,
      );
      await prisma.$executeRawUnsafe(
        `GRANT SELECT ON public.venues, public.payment_submissions TO "${role}"`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE POLICY "${role}" ON public.venues FOR SELECT TO "${role}" USING (true)`,
      );
      const denied = spawnSync(process.execPath, [...args, "--activation"], {
        env: configured,
        encoding: "utf8",
      });
      expect(denied.status).toBe(1);
      for (const table of ["payment_checkouts", "payment_webhook_receipts"]) {
        await prisma.$executeRawUnsafe(
          `CREATE POLICY "${role}" ON public."${table}" FOR ALL TO "${role}" USING (true) WITH CHECK (true)`,
        );
      }
      const allowed = spawnSync(process.execPath, [...args, "--activation"], {
        env: configured,
        encoding: "utf8",
      });
      expect(allowed.status, allowed.stderr).toBe(0);
      expect(allowed.stdout).toContain("database checks passed");
      expect(allowed.stdout).not.toContain(password);
    } finally {
      for (const table of [
        "venues",
        "payment_checkouts",
        "payment_webhook_receipts",
      ]) {
        await prisma.$executeRawUnsafe(
          `DROP POLICY IF EXISTS "${role}" ON public."${table}"`,
        );
      }
      await prisma.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
      await prisma.$executeRawUnsafe(`DROP ROLE "${role}"`);
    }
  });
});
