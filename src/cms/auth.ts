import prisma from "@/lib/prisma";
import {
  SESSION_COOKIE,
  verifySession,
  type SessionUser,
} from "@/lib/auth/session";

/** Revalidate the role: a previously signed admin cookie is not enough. */
export async function resolveCmsAdmin(
  headers: Headers,
): Promise<SessionUser | null> {
  const cookie = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  const session = await verifySession(cookie.slice(SESSION_COOKIE.length + 1));
  if (!session || session.role !== "ADMIN") return null;
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  return user?.role === "ADMIN"
    ? { id: user.id, email: user.email, role: "ADMIN" }
    : null;
}
