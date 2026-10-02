import type { Access } from "payload";
import prisma from "@/lib/prisma";

export const canManageContent = async ({
  req,
}: Parameters<Access>[0]): Promise<boolean> => {
  if (req.user?.collection !== "cms-users" || !req.user.externalUserId)
    return false;
  const user = await prisma.user.findUnique({
    where: { id: req.user.externalUserId },
  });
  return user?.role === "ADMIN";
};
