"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MailCheck, ArrowRight, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhoneLoginForm } from "./PhoneLoginForm";
import { PasswordLoginForm } from "./PasswordLoginForm";
import { Brand } from "@/components/ui/brand";

export type AuthMode = "login" | "signup";

export function LoginForm({
  nextPath,
  mode = "login",
  authError,
  preview = false,
  audience = "player",
}: {
  nextPath?: string;
  mode?: AuthMode;
  authError?: "missing" | "invalid";
  preview?: boolean;
  audience?: "player" | "owner";
}) {
  const signup = mode === "signup";
  const owner = audience === "owner";
  const counterpart = signup ? (owner ? "/owner/login" : "/login") : "/signup";
  const counterpartNext = owner ? "/list-your-venue" : nextPath;
  const counterpartHref = counterpartNext
    ? `${counterpart}?next=${encodeURIComponent(counterpartNext)}`
    : counterpart;

  return (
    <div>
      <div className="mb-7">
        <div className="mb-7 flex items-center justify-between gap-4">
          <Brand className="gap-2 text-lg [&_svg]:size-9" />
          <span className="text-[10px] font-semibold tracking-[0.12em] text-brand-700">{owner ? "VENUE ACCESS" : "LET’S PLAY"}</span>
        </div>
        <h1 className="text-[30px] font-medium leading-tight tracking-[-1px] text-ink sm:text-[34px]">
          {owner ? (signup ? "Create your venue account" : "Your venue workspace") : signup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {owner ? (signup ? "Create your account, then start setting up your home court." : "Sign in, then enter your authenticator code to securely manage your venue.") : signup ? "Find your court and keep every booking in one place." : "Sign in to keep your plans together and get back to the game."}
        </p>
      </div>
      {authError && !preview && (
        <div role="alert" className="mb-5 rounded-lg border border-line bg-mist px-4 py-3 text-sm leading-relaxed text-ink-soft">
          That sign-in link is invalid or expired. Request a new link below to continue.
        </div>
      )}
      {preview ? (
        <div className="rounded-lg border border-brand-700/10 bg-brand-50 p-5" role="status">
          <h2 className="text-xl font-medium tracking-tight text-ink">Accounts are coming soon</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Take a look around Pikol. Sign-ups and court bookings will open soon.
          </p>
          <Button asChild className="mt-5 w-full motion-trigger">
            <Link href="/search">Explore Pikol <ArrowRight className="motion-arrow" aria-hidden /></Link>
          </Button>
        </div>
      ) : (
      <Tabs defaultValue="email" className="gap-6">
        <TabsList className="w-full rounded-full border border-line/70 bg-mist p-1 group-data-[orientation=horizontal]/tabs:h-auto" aria-label={signup ? "Account creation method" : "Sign-in method"}>
          <TabsTrigger value="email" className="h-11 rounded-full px-3 text-ink-soft data-[state=active]:border-line data-[state=active]:text-brand-700"><Mail className="size-4" aria-hidden />Email</TabsTrigger>
          <TabsTrigger value="phone" className="h-11 rounded-full px-3 text-ink-soft data-[state=active]:border-line data-[state=active]:text-brand-700"><Smartphone className="size-4" aria-hidden />Phone number</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="auth-method-panel"><EmailLoginForm nextPath={nextPath} mode={mode} /></TabsContent>
        <TabsContent value="phone" className="auth-method-panel"><PhoneLoginForm nextPath={nextPath} mode={mode} /></TabsContent>
      </Tabs>
      )}
      {!preview && <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-brand-700" aria-hidden /> {owner ? "Two-step verification protects your workspace" : "Secure sign-in. More time to play."}
      </p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1 border-t border-line pt-4 text-sm text-muted-foreground">
        <span>{owner && !signup ? "Listing your first venue?" : signup ? "Already on Pikol?" : "New to Pikol?"}</span>
        <Button asChild variant="link" className="min-h-11 px-2 font-semibold">
          <Link href={counterpartHref}>{owner && !signup ? "Get started" : signup ? "Sign in" : "Create an account"}</Link>
        </Button>
      </div>
    </div>
  );
}

function EmailLoginForm({ nextPath, mode }: { nextPath?: string; mode: AuthMode }) {
  const [useLink, setUseLink] = useState(false);
  return <div className="space-y-4">
    {useLink ? <EmailLinkForm nextPath={nextPath} mode={mode} /> : <PasswordLoginForm nextPath={nextPath} mode={mode} />}
    <Button type="button" variant="ghost" block className="text-xs text-muted-foreground" onClick={() => setUseLink(!useLink)}>{useLink ? "Use a password instead" : "Use an email link instead"}</Button>
  </div>;
}

function EmailLinkForm({ nextPath, mode }: { nextPath?: string; mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-brand-700/10 bg-brand-50 p-5" role="status" aria-live="polite">
          <span className="mb-4 grid size-11 place-items-center rounded-full bg-white text-brand-700 shadow-card">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <h2 className="text-xl font-medium tracking-tight text-ink">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We sent a {mode === "signup" ? "verification" : "sign-in"} link to
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-ink">{email}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open it to {mode === "signup" ? "finish joining Pikol" : "sign in"}. Each link can only be used once.
          </p>
        </div>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">Can&apos;t find it? Check your spam or junk folder.</p>
        <Button type="button" variant="outline" block onClick={() => { setEditingEmail(true); setStatus("idle"); setMessage(null); }}>
          Use another email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label="Email address"
        htmlFor="email"
        error={status === "error" ? (message ?? undefined) : undefined}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={editingEmail}
          className="h-13 bg-canvas focus-visible:bg-white"
          aria-invalid={status === "error" || undefined}
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {mode === "signup" ? "We’ll email you a link to verify your address and get you started." : "We’ll email you a secure link. One tap and you’re in."}
      </p>
      <Button
        type="submit"
        size="lg"
        block
        className="motion-trigger"
        loading={status === "sending"}
      >
        Continue with email
        <ArrowRight
          className="motion-arrow size-4"
          data-direction="right"
          aria-hidden
        />
      </Button>
    </form>
  );
}
