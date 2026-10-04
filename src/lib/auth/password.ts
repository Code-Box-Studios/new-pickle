import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import type { AuthError } from "@supabase/supabase-js";
import { AppError, ForbiddenError, ValidationError } from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";
import { assertFullAppEnabled } from "@/lib/deployment";
import { assertPhoneOrigin } from "./phone-origin";
import { safeNextPath } from "./redirect";
import { ownerDestination, requiresOwnerMfa } from "./owner-security";

export async function passwordRequest(req: NextRequest): Promise<Record<string, unknown>> {
  assertFullAppEnabled();
  if (!req.headers.get("origin")) throw new ForbiddenError("Open Pikol directly to continue.");
  assertPhoneOrigin(req);
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ValidationError();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError();
  return body;
}

export function passwordEmail(value: unknown) {
  if (typeof value !== "string") throw new ValidationError("Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("Enter a valid email address.");
  return email;
}

export function passwordValue(value: unknown, isNew: boolean) {
  if (typeof value !== "string" || !value || value.length > 1024) throw new ValidationError("Enter your password.");
  if (isNew && value.length < 8) throw new ValidationError("Use at least 8 characters for your password.");
  if (isNew && new TextEncoder().encode(value).length > 72) throw new ValidationError("Use a shorter password.");
  return value; // Never trim or normalize a password.
}

export function passwordDestination(value: unknown, role: Role = "CUSTOMER") {
  if (requiresOwnerMfa(role)) return ownerDestination(value, role);
  const next = safeNextPath(value);
  const path = next ? new URL(next, "https://pikol.invalid").pathname : "";
  return next && !["/login", "/signup", "/owner/login", "/owner/verify", "/forgot-password", "/reset-password"].includes(path) && !path.startsWith("/auth/") && !path.startsWith("/api/") ? next : "/bookings";
}

export function privateAuthResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function passwordFailure(error: unknown) {
  // Never log a raw provider exception or echo credential-bearing request data.
  return privateAuthResponse(errorResponse(error instanceof AppError ? error : new AppError("Sign-in is temporarily unavailable. Please try again.", 503, "auth_unavailable")));
}

export function throwPasswordProviderError(error: AuthError): never {
  if (error.status === 429) throw new AppError("Too many attempts. Wait a moment and try again.", 429, "rate_limited");
  if (!error.status || error.status >= 500) throw new AppError("Sign-in is temporarily unavailable. Please try again.", 503, "auth_unavailable");
  if (error.code === "email_not_confirmed") throw new AppError("Confirm your email before signing in. Check your inbox for the link.", 403, "email_not_confirmed");
  if (error.code === "weak_password") throw new ValidationError("Choose a stronger password. Try a longer passphrase with letters, numbers and symbols.");
  if (error.code === "same_password") throw new ValidationError("Choose a password different from your current password.");
  if (error.code === "reauthentication_needed" || error.code === "session_not_found" || error.code === "reauthentication_not_valid") throw new AppError("Verify your email again using Forgot password, then try again.", 401, "reauthentication_needed");
  throw new AppError("Email or password is incorrect.", 401, "invalid_credentials");
}
