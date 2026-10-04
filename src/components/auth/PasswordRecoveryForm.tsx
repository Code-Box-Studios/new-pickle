"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "./PasswordInput";

function RecoveryHeading({ children }: { children: React.ReactNode }) {
  return <><div className="mb-7 flex items-center justify-between gap-4"><Brand className="gap-2 text-lg [&_svg]:size-9" /><span className="text-[10px] font-semibold tracking-[0.12em] text-brand-700">SECURE ACCESS</span></div><h1 className="text-[30px] font-medium leading-tight tracking-[-1px] text-ink sm:text-[34px]">{children}</h1></>;
}

export function PasswordRecoveryForm({ nextPath, authError }: { nextPath?: string; authError?: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(authError ? "That link is invalid or expired. Request a new one below." : null);
  const owner = nextPath?.startsWith("/owner") || nextPath === "/list-your-venue" || nextPath === "/admin";
  const back = `${owner ? "/owner/login" : "/login"}${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/password/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, next: nextPath }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Couldn’t send a link. Please try again.");
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Network error. Please try again."); }
    finally { setBusy(false); }
  }
  return <div><RecoveryHeading>{sent ? "Check your inbox." : "Forgot your password?"}</RecoveryHeading>
    {sent ? <div role="status" className="mt-6 rounded-lg border border-brand-700/10 bg-brand-50 p-5"><MailCheck className="mb-3 size-6 text-brand-700" aria-hidden /><p className="text-sm leading-relaxed text-ink">If this email has a Pikol account, we’ve sent a secure link to <strong className="break-all font-medium">{email}</strong>. Open it to set a new password.</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">The link works once. Check your spam or junk folder too.</p></div> : <><p className="mt-3 text-sm leading-relaxed text-muted-foreground">We’ll verify your email so you can set a new password. This also works if you’ve only used email links before.</p><form onSubmit={submit} className="mt-7 space-y-5">
      {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-ink">{error}</div>}
      <Field label="Email address" htmlFor="recovery-email"><Input id="recovery-email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" className="h-13" value={email} onChange={event => setEmail(event.target.value)} /></Field>
      <Button type="submit" size="lg" block loading={busy} loadingLabel="Sending link">Email me a reset link<ArrowRight aria-hidden /></Button>
    </form></>}
    {sent && <Button type="button" variant="outline" block className="mt-5" onClick={() => setSent(false)}>Use another email</Button>}
    <div className="mt-6 border-t border-line pt-4"><Button asChild variant="ghost" block><Link href={back}><ArrowLeft aria-hidden />Back to sign in</Link></Button></div>
  </div>;
}

export function PasswordResetForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (password !== confirm) { setError("Your passwords don’t match. Enter the same password twice."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, next: nextPath }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Couldn’t update your password. Please try again.");
      setPassword(""); setConfirm(""); router.replace(data.next); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Network error. Please try again."); setBusy(false); }
  }
  return <div><RecoveryHeading>A fresh start.</RecoveryHeading><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your account is verified. Choose a password you’ll use for your next sign-in.</p>
    <form onSubmit={submit} className="mt-7 space-y-5">
      {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-ink">{error}</div>}
      <PasswordInput id="new-password" label="New password" value={password} onChange={setPassword} isNew invalid={!!error} />
      <PasswordInput id="confirm-password" label="Confirm password" value={confirm} onChange={setConfirm} isNew invalid={!!error} />
      <p className="text-xs leading-relaxed text-muted-foreground">At least 8 characters. Choose one you don’t use on other sites.</p>
      <Button type="submit" size="lg" block loading={busy} loadingLabel="Saving password">Save password<ShieldCheck aria-hidden /></Button>
    </form>
  </div>;
}
