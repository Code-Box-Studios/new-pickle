"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { HoldCountdown, useCountdown } from "./HoldCountdown";

export function DetailsForm({
  bookingId,
  expiresAt,
  defaultName,
  defaultMobile,
  defaultEmail,
}: {
  bookingId: string;
  expiresAt: string;
  defaultName: string;
  defaultMobile: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const { expired } = useCountdown(expiresAt);
  const [name, setName] = useState(defaultName);
  const [mobile, setMobile] = useState(defaultMobile);
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Your details</h2>
        <HoldCountdown expiresAt={expiresAt} />
      </div>
      <Field label="Full name" htmlFor="name">
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="mobile" hint="The venue may contact you here.">
        <Input
          id="mobile"
          inputMode="tel"
          required
          placeholder="09XX XXX XXXX"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="lg" block loading={submitting} disabled={expired}>
        {expired ? "Hold expired" : "Continue to payment"}
      </Button>
    </form>
  );
}
