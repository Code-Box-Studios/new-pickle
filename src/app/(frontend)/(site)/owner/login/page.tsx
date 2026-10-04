import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignInSession } from "@/lib/auth/session";
import { ownerDestination, ownerVerificationPath, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { AuthShell } from "@/components/auth/AuthShell";
import { OwnerLoginForm } from "@/components/auth/OwnerLoginForm";
import { isPreviewMode } from "@/lib/deployment";

export const metadata: Metadata = { title: "Venue sign in", robots: { index: false } };

export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const session = await getSignInSession();
  const next = ownerDestination(sp.next, session?.role);
  if (session && requiresOwnerMfa(session.role)) redirect(session.mfaVerified ? next : ownerVerificationPath(next));
  if (session) redirect("/list-your-venue");
  return <AuthShell audience="owner"><OwnerLoginForm nextPath={next} preview={isPreviewMode()} authError={sp.error === "invalid" || sp.error === "missing" ? sp.error : undefined} /></AuthShell>;
}
