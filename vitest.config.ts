import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env" });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // DB-backed tests share one Postgres schema; run files serially.
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
