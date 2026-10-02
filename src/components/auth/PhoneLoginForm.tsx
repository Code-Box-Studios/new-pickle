"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

type Challenge = { id: string; phone: string; retryAfter: number; devCode?: string };

export function PhoneLoginForm({ nextPath }: { nextPath?: string }) {
  const [phone, setPhone] = useState("");
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
        <p className="text-center text-sm leading-relaxed text-muted-foreground">Enter the six-digit code for <strong className="whitespace-nowrap font-medium text-ink">{challenge.phone}</strong>.</p>
        {challenge.devCode && process.env.NODE_ENV !== "production" && (
          <p role="status" className="rounded-lg bg-warning px-4 py-3 text-center text-sm text-warning-foreground">Development code: <strong className="font-mono tracking-widest">{challenge.devCode}</strong></p>
        )}
        <Field label="Verification code" htmlFor="phone-code" error={error ?? undefined}>
          <Input id="phone-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="h-14 text-center font-mono text-2xl tracking-[0.35em]" aria-invalid={!!error || undefined} />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>Verify & sign in<ArrowRight className="size-4" aria-hidden /></Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => { setChallenge(null); setError(null); setCode(""); }}>Change number</Button>
          <Button type="button" variant="ghost" size="sm" disabled={loading || cooldown > 0} onClick={requestCode}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">The code expires in 10 minutes.</p>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void requestCode(); }} className="space-y-6">
      <p className="text-center text-sm leading-relaxed text-muted-foreground">Sign in with a code sent to your mobile.</p>
      <Field label="Mobile number" htmlFor="phone" hint="Use a Philippine number, such as 0917 123 4567." error={error ?? undefined}>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-700" aria-hidden />
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="09XX XXX XXXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="pl-10" aria-invalid={!!error || undefined} />
        </div>
      </Field>
      <Button type="submit" size="lg" block loading={loading}>Send verification code<ArrowRight className="size-4" aria-hidden /></Button>
    </form>
  );
}
