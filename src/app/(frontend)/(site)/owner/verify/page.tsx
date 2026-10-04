import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignInSession } from "@/lib/auth/session";
import { ownerDestination, requiresOwnerMfa } from "@/lib/auth/owner-security";
import { AuthShell } from "@/components/auth/AuthShell";
import { OwnerMfaForm } from "@/components/auth/OwnerMfaForm";

export const metadata: Metadata = { title: "Verify venue access", robots: { index: false } };

export default async function OwnerVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const session = await getSignInSession();
  const next = ownerDestination(sp.next, session?.role);
  if (!session) redirect(`/owner/login?next=${encodeURIComponent(next)}`);
  if (!requiresOwnerMfa(session.role)) redirect("/list-your-venue");
  if (session.mfaVerified) redirect(next);
  return <AuthShell audience="owner"><OwnerMfaForm nextPath={next} /></AuthShell>;
}
