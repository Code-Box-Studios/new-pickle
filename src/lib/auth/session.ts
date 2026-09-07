import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production",
);
export const SESSION_COOKIE = "rallypoint_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

export async function signSession(u: SessionUser): Promise<string> {
  return new SignJWT({ email: u.email, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function getSessionFromRequest(
  req: NextRequest,
): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
  };
}

export function clearSessionCookie() {
  return { name: SESSION_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 };
}
