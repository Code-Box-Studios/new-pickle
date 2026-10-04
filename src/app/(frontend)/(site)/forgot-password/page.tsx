import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";
import { safeNextPath } from "@/lib/auth/redirect";
import { isPreviewMode } from "@/lib/deployment";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const owner = next?.startsWith("/owner") || next === "/list-your-venue" || next === "/admin";
  return <AuthShell audience={owner ? "owner" : "player"}>{isPreviewMode() ? <LoginForm preview /> : <PasswordRecoveryForm nextPath={next} authError={!!sp.error} />}</AuthShell>;
}
