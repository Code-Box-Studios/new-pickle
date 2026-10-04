import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/supabase/request";
import { resolveSupabaseUser } from "@/lib/auth/supabase-user";
import { getSessionFromRequest } from "@/lib/auth/session";
import { resolveMagicLinkBase } from "@/lib/auth/magic-link";
import { ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { passwordDestination, passwordEmail, passwordFailure, passwordRequest, passwordValue, privateAuthResponse, throwPasswordProviderError } from "@/lib/auth/password";
import { UnauthorizedError, ValidationError } from "@/lib/booking/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await passwordRequest(req);
    if (body.action !== "login" && body.action !== "signup") throw new ValidationError();
    const email = passwordEmail(body.email);
    const password = passwordValue(body.password, body.action === "signup");
    const client = createSupabaseRequestClient(req);
    const redirect = new URL("/auth/verify", resolveMagicLinkBase(req.headers.get("origin")!));
    redirect.searchParams.set("next", passwordDestination(body.next));
    const result = body.action === "signup"
      ? await client.supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect.toString() } })
      : await client.supabase.auth.signInWithPassword({ email, password });
    // Hosted confirmation and duplicate-account responses must not grant access.
    if (body.action === "signup" && (!result.error && !result.data.session || result.error?.code === "user_already_exists")) {
      return privateAuthResponse(NextResponse.json({ ok: true, confirmationRequired: true }));
    }
    if (result.error) throwPasswordProviderError(result.error);
    if (!result.data.user || !result.data.session) throw new UnauthorizedError("Email or password is incorrect.");
    const user = await resolveSupabaseUser(result.data.user);
    if (!user) throw new UnauthorizedError("Unable to sign in. Verify your email or contact support.");
    const destination = passwordDestination(body.next, user.role);
    const next = requiresOwnerMfa(user.role) ? ownerVerificationPath(destination) : destination;
    return privateAuthResponse(client.applyCookies(NextResponse.json({ ok: true, next })));
  } catch (error) { return passwordFailure(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await passwordRequest(req);
    // The central session gate requires TOTP for every privileged role.
    const session = await getSessionFromRequest(req);
    if (!session) throw new UnauthorizedError("Sign in and complete verification before changing your password.");
    if (!session.email) throw new ValidationError("Sign in with a verified email to set a password.");
    const password = passwordValue(body.password, true);
    const client = createSupabaseRequestClient(req);
    // A phone session can retain an old application email. Require a fresh,
    // confirmed email on the provider identity that owns this password.
    const identity = await client.supabase.auth.getUser();
    if (identity.error || !identity.data.user || identity.data.user.is_anonymous) throw new UnauthorizedError("Verify your email again before changing your password.");
    if (!identity.data.user.email || !identity.data.user.email_confirmed_at) throw new ValidationError("Sign in with a verified email to set a password.");
    const result = await client.supabase.auth.updateUser({ password });
    if (result.error) throwPasswordProviderError(result.error);
    if (!result.data.user) throw new UnauthorizedError();
    return privateAuthResponse(client.applyCookies(NextResponse.json({ ok: true, next: passwordDestination(body.next, session.role) })));
  } catch (error) { return passwordFailure(error); }
}
