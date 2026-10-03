import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env" });

/**
 * Runs once before the whole suite: apply committed migrations to the test
 * database. We use `migrate deploy` (never `migrate dev`) so the generated
 * `period` column + EXCLUDE constraint apply without drift prompts.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
  execSync("npm run cms:migrate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, CMS_DATABASE_URL: url },
  });
}
