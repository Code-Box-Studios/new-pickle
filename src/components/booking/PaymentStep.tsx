"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { HoldCountdown, useCountdown } from "./HoldCountdown";
import { pesos } from "@/lib/format";
import { channelLabel } from "@/lib/payment";
import { cn } from "@/lib/cn";
import type { PaymentChannel } from "@/generated/prisma";

export interface PaymentMethodDTO {
  id: string;
  channel: PaymentChannel;
  accountName: string;
  accountNumber: string;
  instructions: string | null;
}

export function PaymentStep({
  bookingId,
  reference,
  expiresAt,
  amountCents,
  venueName,
  methods,
}: {
  bookingId: string;
  reference: string;
  expiresAt: string;
  amountCents: number;
  venueName: string;
  methods: PaymentMethodDTO[];
}) {
  const router = useRouter();
  const { expired } = useCountdown(expiresAt);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [payRef, setPayRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = methods.find((m) => m.id === methodId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!method) return setError("Select a payment method");
    if (!file) return setError("Upload a screenshot of your payment");
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("channel", method.channel);
      fd.set("paymentMethodId", method.id);
      fd.set("reference", payRef);
      fd.set("proof", file);
      const res = await fetch(`/api/bookings/${bookingId}/payment`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/bookings/${reference}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Pay the venue</h2>
        <HoldCountdown expiresAt={expiresAt} />
      </div>

      <div className="rounded-2xl bg-brand-50 p-4">
        <p className="text-sm text-brand-800">
          Payment is made <strong>directly to {venueName}</strong>. RallyPoint never
          holds your money. Send the exact amount, then upload your screenshot below.
        </p>
        <p className="mt-2 text-2xl font-extrabold text-ink">{pesos(amountCents)}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink-soft">Pay via</legend>
        {methods.length === 0 && (
          <p className="text-sm text-muted">
            This venue hasn&apos;t configured a payment method yet.
          </p>
        )}
        {methods.map((m) => (
          <label key={m.id}>
            <Card
              className={cn(
                "cursor-pointer p-3.5 transition",
                methodId === m.id
                  ? "border-brand-600 bg-brand-50"
                  : "hover:border-black/10",
              )}
            >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="method"
                className="mt-1 accent-brand-600"
                checked={methodId === m.id}
                onChange={() => setMethodId(m.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {channelLabel(m.channel)}
                </span>
                <span className="block text-sm text-ink-soft">
                  {m.accountName} · {m.accountNumber}
                </span>
                {m.instructions && (
                  <span className="mt-0.5 block text-xs text-muted">{m.instructions}</span>
                )}
              </span>
            </span>
            </Card>
          </label>
        ))}
      </fieldset>

      <Field label="Payment reference number" htmlFor="payref" hint="From your GCash/Maya receipt.">
        <Input
          id="payref"
          required
          value={payRef}
          onChange={(e) => setPayRef(e.target.value)}
          placeholder="e.g. 0123 4567 8901"
        />
      </Field>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink-soft">Payment screenshot</span>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-black/20 p-4 hover:bg-black/5">
          <Upload className="size-5 text-brand-600" aria-hidden />
          <span className="text-sm text-ink-soft">
            {file ? file.name : "Tap to upload JPG, PNG, or WebP (max 5 MB)"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" size="lg" block loading={submitting} disabled={expired}>
        {expired ? "Hold expired" : "Submit payment"}
      </Button>
      <p className="text-center text-xs text-muted">
        The venue confirms within their stated window — we&apos;ll notify you.
      </p>
    </form>
  );
}
