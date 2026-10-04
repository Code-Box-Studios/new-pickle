import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSignInSession } from "@/lib/auth/session";
import { ownerDestination, ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { isPreviewMode } from "@/lib/deployment";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSignInSession();
  if (session && requiresOwnerMfa(session.role)) {
    const next = ownerDestination(sp.next, session.role);
    redirect(session.mfaVerified ? next : ownerVerificationPath(next));
  }
  if (session) redirect(safeNextPath(sp.next) ?? "/bookings");

  return (
    <AuthShell>
      <LoginForm preview={isPreviewMode()} mode="signup" nextPath={safeNextPath(sp.next)} authError={sp.error === "missing" || sp.error === "invalid" ? sp.error : undefined} />
    </AuthShell>
  );
}
