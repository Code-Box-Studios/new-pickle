import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordResetForm } from "@/components/auth/PasswordRecoveryForm";
import { Button } from "@/components/ui/button";
import { getSession, getSignInSession } from "@/lib/auth/session";
import { ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const identity = await getSignInSession();
  const owner = identity && requiresOwnerMfa(identity.role);
  if (owner && !identity.mfaVerified) {
    const returnPath = `/reset-password${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    redirect(ownerVerificationPath(returnPath));
  }
  const session = await getSession();
  const forgot = `/forgot-password${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return <AuthShell audience={owner ? "owner" : "player"}>{session?.email ? <PasswordResetForm nextPath={next} /> : <div><h1 className="text-3xl font-medium tracking-tight text-ink">Verify your email first.</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Open the link from your Pikol email to set a password. Request a fresh link if yours has expired.</p><Button asChild block className="mt-6"><Link href={forgot}>Request an email link</Link></Button></div>}</AuthShell>;
}
