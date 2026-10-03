"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Smartphone, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import type { AuthMode } from "./LoginForm";

type Challenge = { id: string; phone: string; retryAfter: number };

export function PhoneLoginForm({ nextPath, mode = "login" }: { nextPath?: string; mode?: AuthMode }) {
  const [phone, setPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  async function requestCode() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/phone/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn't send a code.");
      setChallenge(data);
      setCooldown(data.retryAfter);
      setCode("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code, next: nextPath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "That code couldn't be verified.");
      window.location.assign(data.next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      setLoading(false);
    }
  }

  if (challenge) {
    return (
      <form onSubmit={verify} className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-brand-700/10 bg-brand-50 p-4" role="status">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-700"><MessageSquareText className="size-4" aria-hidden /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Check your messages</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Enter the six-digit code sent to <strong className="break-words font-medium text-ink">{challenge.phone}</strong>.</p>
          </div>
        </div>
        <Field label="Verification code" htmlFor="phone-code" error={error ?? undefined}>
          <Input id="phone-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="h-16 bg-canvas text-center font-mono text-2xl tracking-[0.35em] placeholder:text-muted-foreground/40" aria-invalid={!!error || undefined} />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>{mode === "signup" ? "Verify & create account" : "Verify & sign in"}<ArrowRight className="size-4" aria-hidden /></Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs sm:text-sm" disabled={loading} onClick={() => { setEditingPhone(true); setChallenge(null); setError(null); setCode(""); }}>Change number</Button>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-xs sm:text-sm" disabled={loading || cooldown > 0} onClick={requestCode}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Codes can only be used once. Request a new code if yours expires.</p>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void requestCode(); }} className="space-y-5">
      <Field label="Mobile number" htmlFor="phone" hint="Philippine numbers: 09… or +639…" error={error ?? undefined}>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-4 top-[18px] size-4 text-brand-700" aria-hidden />
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus={editingPhone} required placeholder="0917 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-13 bg-canvas pl-11 focus-visible:bg-white" aria-describedby="phone-description" aria-invalid={!!error || undefined} />
        </div>
      </Field>
      <p className="text-sm leading-relaxed text-muted-foreground">We&apos;ll text you a verification code. {mode === "signup" ? "Verify your number to join Pikol." : "Use it to sign in securely."}</p>
      <Button type="submit" size="lg" block loading={loading}>Continue with phone<ArrowRight className="size-4" aria-hidden /></Button>
    </form>
  );
}
