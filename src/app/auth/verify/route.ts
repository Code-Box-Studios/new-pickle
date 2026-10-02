import { NextRequest, NextResponse } from "next/server";
import { consumeMagicToken } from "@/lib/auth/magic-link";
import { signSession, sessionCookie } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", req.url));
  }

  const user = await consumeMagicToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url));
  }

  const roleHome =
    user.role === "OWNER" || user.role === "STAFF" || user.role === "ADMIN"
      ? "/owner"
      : "/bookings";
  const next = safeNextPath(req.nextUrl.searchParams.get("next")) ?? roleHome;

  const jwt = await signSession(user);
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(sessionCookie(jwt));
  return res;
}
