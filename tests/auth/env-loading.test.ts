import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

describe("database CLI environment loading", () => {
  it("matches Next env precedence while keeping explicit test URLs isolated", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pikol-env-"));
    const script = path.resolve("scripts/with-env.mjs");
    try {
      await writeFile(path.join(dir, ".env"), "DATABASE_URL=old-local\n");
      await writeFile(path.join(dir, ".env.local"), "DATABASE_URL=supabase-runtime\nDIRECT_URL=supabase-migrations\n");
      const command = [script, process.execPath, "-e", "process.stdout.write(JSON.stringify([process.env.DATABASE_URL,process.env.DIRECT_URL]))"];
      const env = { PATH: process.env.PATH, NODE_ENV: "test" as const };
      expect(JSON.parse(execFileSync(process.execPath, command, { cwd: dir, env }).toString())).toEqual(["supabase-runtime", "supabase-migrations"]);
      expect(JSON.parse(execFileSync(process.execPath, command, { cwd: dir, env: { ...env, DATABASE_URL: "isolated-test", DIRECT_URL: "isolated-test" } }).toString())).toEqual(["isolated-test", "isolated-test"]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
