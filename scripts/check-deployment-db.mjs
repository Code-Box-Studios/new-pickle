import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// Preview pages do not use the application database.
if (process.env.APP_PREVIEW_MODE === "true") {
  console.log("Public preview: database migration check skipped.");
} else if (!process.env.DATABASE_URL) {
  console.error("Deployment blocked: DATABASE_URL is required for the full app.");
  process.exitCode = 1;
} else {
  process.env.DIRECT_URL ||= process.env.DATABASE_URL;
  const require = createRequire(import.meta.url);
  // Status only reads migration metadata. Schema changes require a separate administrator step.
  const result = spawnSync(process.execPath, [require.resolve("prisma"), "migrate", "status"], {
    stdio: "inherit",
    env: process.env,
    timeout: 90000,
  });
  if (result.error || result.status !== 0) {
    console.error("Deployment blocked: apply the committed database migrations with an administrator connection, then rebuild.");
    process.exitCode = 1;
  }
}
