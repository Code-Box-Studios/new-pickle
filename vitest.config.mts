import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env" });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Only our source tests — never build output copied into .next/standalone.
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/.next/**"],
    // DB-backed tests share one Postgres schema; run files serially.
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
