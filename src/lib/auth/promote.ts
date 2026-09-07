import prisma from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

/** Promote a CUSTOMER to OWNER on first venue creation. No-op for other roles. */
export async function promoteToOwner(
  userId: string,
): Promise<{ role: Role; promoted: boolean }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "CUSTOMER") {
    await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });
    return { role: "OWNER", promoted: true };
  }
  return { role: user.role, promoted: false };
}
