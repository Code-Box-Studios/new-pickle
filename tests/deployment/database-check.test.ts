import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/check-deployment-db.mjs");
const scratch: string[] = [];
afterEach(() => { for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true }); });
function check(cwd = process.cwd(), env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd, encoding: "utf8", timeout: 20000,
    env: { ...process.env, APP_PREVIEW_MODE: "false", DATABASE_URL: process.env.TEST_DATABASE_URL!, DIRECT_URL: process.env.TEST_DATABASE_URL!, ...env },
  });
}
describe("Deployment database gate", () => {
  it("passes when all committed migrations are applied", () => {
    const result = check();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
  it("blocks a release with a pending migration without applying it", () => {
    const dir = mkdtempSync(join(tmpdir(), "pikol-deployment-check-")); scratch.push(dir);
    cpSync(resolve("prisma"), join(dir, "prisma"), { recursive: true });
    const pending = join(dir, "prisma/migrations/20990101000000_pending_gate_test");
    mkdirSync(pending);
    writeFileSync(join(pending, "migration.sql"), "SELECT 1;\n");
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("20990101000000_pending_gate_test");
    expect(check().status).toBe(0);
  });
  it("allows the explicit public preview without database credentials", () => {
    const result = check(undefined, { APP_PREVIEW_MODE: "true", DATABASE_URL: "", DIRECT_URL: "" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("preview");
  });
  it("blocks full app deployment when database credentials are missing", () => {
    const result = check(undefined, { DATABASE_URL: "", DIRECT_URL: "" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATABASE_URL");
  });
});
