import type { CollectionConfig } from "payload";
import { resolveCmsAdmin } from "./auth";
import { canManageContent } from "./access";

export const CmsUsers: CollectionConfig = {
  slug: "cms-users",
  admin: { hidden: true, useAsTitle: "email" },
  access: {
    admin: canManageContent,
    read: canManageContent,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [
      {
        name: "rallypoint-admin",
        authenticate: async ({ headers, payload }) => {
          const admin = await resolveCmsAdmin(headers);
          if (!admin) return { user: null };
          const find = () =>
            payload.find({
              collection: "cms-users",
              where: { externalUserId: { equals: admin.id } },
              limit: 1,
              overrideAccess: true,
            });
          let user = (await find()).docs[0];
          if (!user) {
            try {
              user = await payload.create({
                collection: "cms-users",
                data: { email: admin.email, externalUserId: admin.id },
                overrideAccess: true,
              });
            } catch (error) {
              // Two parallel first visits may race on the unique external ID.
              user = (await find()).docs[0];
              if (!user) throw error;
            }
          }
          return { user: { ...user, collection: "cms-users" as const } };
        },
      },
    ],
  },
  fields: [
    { name: "email", type: "email", required: true },
    {
      name: "externalUserId",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
  ],
};
