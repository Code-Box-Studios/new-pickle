import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { seedContent } from "../src/cms/seed";
import prisma from "../src/lib/prisma";

const payload = await getPayload({ config });
try {
  await seedContent(payload);
  console.log("CMS content ready. Existing edits preserved.");
} finally {
  await payload.destroy();
  await prisma.$disconnect();
}
// Payload's Postgres adapter retains a listener connection. All writes above
// have completed; follow its CLI convention and end this one-shot process.
process.exit(0);
