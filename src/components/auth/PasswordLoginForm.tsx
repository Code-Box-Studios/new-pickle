"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "./PasswordInput";
import type { AuthMode } from "./LoginForm";

export function PasswordLoginForm({ nextPath, mode }: { nextPath?: string; mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, email, password, next: nextPath }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn’t sign in. Please try again.");
      setPassword("");
      if (data.confirmationRequired) { setConfirmation(true); setBusy(false); }
      else { router.replace(data.next); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Network error. Please try again."); setBusy(false); }
  }

  if (confirmation) return <div className="space-y-5">
    <div role="status" className="rounded-lg border border-brand-700/10 bg-brand-50 p-5">
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-white text-brand-700"><MailCheck aria-hidden /></span>
      <h2 className="text-xl font-medium tracking-tight text-ink">Confirm your email</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Check <strong className="break-all font-medium text-ink">{email}</strong> for your confirmation link. If you already have an account, sign in or reset your password.</p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Can’t find it? Check your spam or junk folder.</p>
    </div>
    <Button type="button" variant="outline" block onClick={() => { setConfirmation(false); setError(null); }}>Use another email</Button>
  </div>;

  return <form onSubmit={submit} className="space-y-5">
    {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-ink">{error}</div>}
    <Field label="Email address" htmlFor="password-email"><Input id="password-email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} className="h-13 bg-canvas" /></Field>
    <div className="space-y-2.5">
      <PasswordInput id="password" value={password} onChange={setPassword} isNew={signup} invalid={!!error} />
      {signup ? <p className="text-xs leading-relaxed text-muted-foreground">At least 8 characters. A longer passphrase works well.</p> : <div className="flex justify-end"><Button asChild variant="link" className="min-h-11 px-0 text-xs"><Link href={`/forgot-password${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>Forgot password?</Link></Button></div>}
    </div>
    <Button type="submit" size="lg" block loading={busy} loadingLabel={signup ? "Creating account" : "Signing in"}>{signup ? "Create account" : "Sign in"}<ArrowRight aria-hidden /></Button>
  </form>;
}
