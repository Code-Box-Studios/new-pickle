"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-ink">Check your email</h1>
        <p className="mt-2 text-muted">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. Open it
          on this device to continue.
        </p>
        <p className="mt-4 text-sm text-muted">
          In development, use the yellow banner at the top to open the link
          instantly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1 text-muted">
          We&apos;ll email you a magic link — no password needed.
        </p>
      </div>
      {nextPath && <input type="hidden" value={nextPath} readOnly />}
      <Field label="Email" htmlFor="email" error={status === "error" ? message ?? undefined : undefined}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" block loading={status === "sending"}>
        Send magic link
      </Button>
    </form>
  );
}
