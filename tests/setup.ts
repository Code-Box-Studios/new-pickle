import { config } from "dotenv";

// Load env and route Prisma at the dedicated test database. This runs before
// test files import "@/lib/prisma", so the client picks up the test URL.
config({ path: ".env" });
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
