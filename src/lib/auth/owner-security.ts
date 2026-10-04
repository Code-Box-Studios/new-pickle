import type { Role } from "@/generated/prisma";
import { safeNextPath } from "./redirect";

export function requiresOwnerMfa(role: Role) {
  return role === "OWNER" || role === "STAFF" || role === "ADMIN";
}

/** A local destination that cannot loop back into the authentication screens. */
export function ownerDestination(value: unknown, role: Role = "OWNER") {
  const next = safeNextPath(value);
  const path = next ? new URL(next, "https://pikol.invalid").pathname : "";
  if (next && !["/login", "/signup", "/owner/login", "/owner/verify"].includes(path) && !path.startsWith("/auth/")) return next;
  return role === "ADMIN" ? "/admin" : "/owner";
}

export function ownerVerificationPath(next: string) {
  return `/owner/verify?next=${encodeURIComponent(next)}`;
}
