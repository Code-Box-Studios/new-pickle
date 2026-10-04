"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, KeyRound, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";

type Factor = { id: string; name: string };
type Setup = { id: string; qrCode: string; secret: string };

export function OwnerMfaForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [factorId, setFactorId] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"loading" | "enrolling" | "verifying" | null>("loading");
  const [error, setError] = useState<string | null>(null);
  const setupPanel = useRef<HTMLDivElement>(null);

  const load = useCallback((signal?: AbortSignal) => {
    return fetch("/api/auth/mfa", { cache: "no-store", signal })
      .then(async res => ({ res, data: await res.json() }))
      .then(({ res, data }) => {
        if (res.status === 401) {
          router.replace(`/owner/login?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Couldn’t load your authenticator. Try again.");
        if (signal?.aborted) return;
        setFactors(data.factors);
        setFactorId(data.factors[0]?.id || "");
        setSetup(null);
    }).catch(cause => {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Network error. Please try again.");
    }).finally(() => { if (!signal?.aborted) setBusy(null); });
  }, [router, nextPath]);

  function reload() {
    setBusy("loading");
    setError(null);
    void load();
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    // Keep the QR in view on phones, while moving keyboard focus into setup.
    if (setup) setupPanel.current?.focus({ preventScroll: true });
  }, [setup]);

  async function enroll() {
    setBusy("enrolling");
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enroll" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn’t start setup. Try again.");
      setSetup(data);
      setFactorId(data.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Network error. Please try again."); }
    finally { setBusy(null); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("verifying");
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId, code, next: nextPath }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn’t verify that code. Try again.");
      router.replace(data.next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Network error. Please try again.");
      setBusy(null);
    }
  }

  const hasFactor = !!factorId;
  return (
    <div>
      <div className="mb-7 flex items-center justify-between gap-4">
        <Brand className="gap-2 text-lg [&_svg]:size-9" />
        <span className="text-[10px] font-semibold tracking-[0.12em] text-brand-700">SECURE ACCESS</span>
      </div>
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-brand-700/10 bg-brand-50 px-4 py-3 text-sm text-brand-700">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-white"><Check className="size-3.5" aria-hidden /></span>
        Signed in. One more step to your workspace.
      </div>
      <h1 className="text-[30px] font-medium leading-tight tracking-[-1px] text-ink sm:text-[34px]">Protect your home court.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {setup ? "Scan the QR code with your authenticator app, then enter the six-digit code." : hasFactor ? "Enter the six-digit code from your authenticator app to open your venue workspace." : "An authenticator adds a second layer of protection to your venue, bookings and payment details."}
      </p>
      {error && <div role="alert" id="mfa-error" className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-ink">{error}</div>}
      {busy === "loading" ? (
        <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Checking your security setup…</div>
      ) : factors === null ? (
        <Button variant="outline" block className="mt-6" onClick={reload}>Try again</Button>
      ) : !hasFactor ? (
        <div className="mt-7 space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <div><p className="text-sm font-semibold text-ink">Use an authenticator app</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Google Authenticator, Microsoft Authenticator or another TOTP app. Codes work without an SMS.</p></div>
          </div>
          <Button size="lg" block loading={busy === "enrolling"} loadingLabel="Starting setup" onClick={enroll}>Set up authenticator <ArrowRight aria-hidden /></Button>
          {error && <Button variant="link" block onClick={reload}>Check for an existing authenticator</Button>}
        </div>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-5">
          {setup && (
            <div ref={setupPanel} role="group" aria-label="Authenticator setup" tabIndex={-1} className="rounded-lg border border-border bg-surface p-4 text-center outline-none">
              <div className="mx-auto w-fit rounded-lg bg-white p-3">
                {/* The QR is a private data URI from Supabase, never an external image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrCode} width={176} height={176} className="max-w-full" alt="Scan this QR code with your authenticator app" />
              </div>
              <Button type="button" variant="link" className="mt-2 max-w-full px-0 text-xs" onClick={() => setShowKey(!showKey)}><KeyRound className="size-3.5" aria-hidden />{showKey ? "Hide setup key" : "Use a setup key instead"}</Button>
              {showKey && <div className="mt-2 rounded-md border border-border bg-white p-3"><p className="mb-2 text-xs text-muted-foreground">Add an account named Pikol with this key:</p><code className="break-all text-sm tracking-wide text-ink">{setup.secret}</code></div>}
            </div>
          )}
          {factors.length > 1 && <Field label="Authenticator" htmlFor="mfa-factor"><SelectField id="mfa-factor" value={factorId} onValueChange={setFactorId}>{factors.map(factor => <SelectItem key={factor.id} value={factor.id}>{factor.name}</SelectItem>)}</SelectField></Field>}
          <Field label="Authenticator code" htmlFor="mfa-code">
            <Input id="mfa-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus={!setup} placeholder="000000" className="h-13 text-center text-xl tracking-[0.35em]" aria-invalid={!!error || undefined} aria-describedby={error ? "mfa-error" : "mfa-code-hint"} />
            <p id="mfa-code-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">Codes change every 30 seconds. Use the latest one in your app.</p>
          </Field>
          <Button type="submit" size="lg" block disabled={code.length !== 6} loading={busy === "verifying"} loadingLabel="Verifying">Verify &amp; open workspace <ShieldCheck aria-hidden /></Button>
          {setup && <p className="text-xs leading-relaxed text-muted-foreground">Keep access to your authenticator. You’ll need it when you sign in again.</p>}
        </form>
      )}
      <div className="mt-7 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">Lost your authenticator? Contact your Pikol administrator. Your identity must be verified before access can be restored.</p>
        <form action="/api/auth/logout" method="POST" className="mt-3"><Button type="submit" variant="ghost" block className="text-muted-foreground"><LogOut className="size-4" aria-hidden />Use another account</Button></form>
      </div>
    </div>
  );
}
