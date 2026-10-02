"use client";

import { useState } from "react";
import { Mail, MailCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
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
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-lg bg-mist text-brand-700">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-ink">
          Check your email
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          We sent a sign-in link to{" "}
          <strong className="break-words font-semibold text-ink">
            {email}
          </strong>
          . Open it on this device to continue.
        </p>
        <p className="mt-6 rounded-xl bg-mist px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          In development, use the banner at the top to open the link instantly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-lg bg-mist text-brand-700">
          <Mail className="size-6" aria-hidden />
        </div>
        <p className="eyebrow mb-2">Welcome to RallyPoint</p>
        <h1 className="text-3xl font-medium tracking-tight text-ink">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We&apos;ll email you a magic link — no password needed.
        </p>
      </div>
      {nextPath && <input type="hidden" value={nextPath} readOnly />}
      <Field
        label="Email"
        htmlFor="email"
        error={status === "error" ? (message ?? undefined) : undefined}
      >
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={status === "error" || undefined}
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        block
        className="motion-trigger"
        loading={status === "sending"}
      >
        Send magic link
        <ArrowRight
          className="motion-arrow size-4"
          data-direction="right"
          aria-hidden
        />
      </Button>
    </form>
  );
}
