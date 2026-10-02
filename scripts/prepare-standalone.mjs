import { cp } from "node:fs/promises";

// Next's standalone output omits static files; npm start serves this bundle.
await Promise.all([
  cp("public", ".next/standalone/public", { recursive: true }),
  cp(".next/static", ".next/standalone/.next/static", { recursive: true }),
]);
