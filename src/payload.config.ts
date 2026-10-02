import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { CmsUsers } from "./cms/users";
import { contentGlobals } from "./cms/globals";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? "",
  routes: { admin: "/cms", api: "/api/cms" },
  admin: {
    user: "cms-users",
    theme: "light",
    avatar: "default",
    meta: { titleSuffix: "· Pikol Content" },
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, "app/(payload)/cms/importMap.js"),
    },
    components: {
      graphics: {
        Logo: "/cms/AdminBrand#AdminBrand",
        Icon: "/cms/AdminBrand#AdminIcon",
      },
      beforeDashboard: ["/cms/AdminBrand#EditorIntro"],
      logout: { Button: "/cms/AdminBrand#EditorLogout" },
    },
  },
  collections: [CmsUsers],
  globals: contentGlobals,
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.CMS_DATABASE_URL || process.env.DATABASE_URL,
      connectionTimeoutMillis: 1500,
      query_timeout: 1500,
      statement_timeout: 1500,
    },
    schemaName: "cms",
    push: false,
    migrationDir: path.resolve(dirname, "cms/migrations"),
  }),
  typescript: { outputFile: path.resolve(dirname, "cms/payload-types.ts") },
  graphQL: { disable: true },
});
