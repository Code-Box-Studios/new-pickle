"use client";

import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { HoldCountdown, useCountdown } from "./HoldCountdown";
import { pesos } from "@/lib/format";
import { channelLabel } from "@/lib/payment";
import { cn } from "@/lib/cn";
import { MAX_PROOF_BYTES } from "@/lib/storage/proof-storage";
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
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <h2 className="section-title">Pay the venue</h2>
        <HoldCountdown expiresAt={expiresAt} />
      </div>

      <Card className="rounded-lg border border-brand-100 bg-brand-50 p-5">
        <p className="break-words text-sm leading-6 text-brand-800">
          Payment is made <strong>directly to {venueName}</strong>. Pikol
          never holds your money. Send the exact amount, then upload your
          screenshot below.
        </p>
        <p className="mt-4 text-3xl font-medium tracking-tight text-ink">
          {pesos(amountCents)}
        </p>
      </Card>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ink">Pay via</legend>
        {methods.length === 0 && (
          <p className="text-sm leading-6 text-muted-foreground">
            This venue hasn&apos;t configured a payment method yet.
          </p>
        )}
        <RadioGroup
          name="method"
          value={methodId}
          onValueChange={setMethodId}
          aria-label="Pay via"
        >
          {methods.map((m) => (
            <Label
              key={m.id}
              htmlFor={`method-${m.id}`}
              className={cn(
                "block cursor-pointer rounded-lg border p-4 transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2",
                methodId === m.id
                  ? "border-brand-700 bg-brand-50"
                  : "border-line bg-surface hover:border-brand-200 hover:bg-mist/50",
              )}
            >
              <span className="flex items-start gap-3">
                <RadioGroupItem
                  id={`method-${m.id}`}
                  value={m.id}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-6 text-ink">
                    {channelLabel(m.channel)}
                  </span>
                  <span className="mt-1 block break-words text-sm leading-6 text-ink-soft">
                    {m.accountName} · {m.accountNumber}
                  </span>
                  {m.instructions && (
                    <span className="mt-2 block break-words text-sm leading-6 text-muted-foreground">
                      {m.instructions}
                    </span>
                  )}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <Field
        label="Payment reference number"
        htmlFor="payref"
        hint="From your GCash/Maya receipt."
      >
        <Input
          id="payref"
          required
          value={payRef}
          onChange={(e) => setPayRef(e.target.value)}
          placeholder="e.g. 0123 4567 8901"
        />
      </Field>

      <div className="space-y-2">
        <span
          id="payment-screenshot-label"
          className="block text-sm font-medium text-ink"
        >
          Payment screenshot
        </span>
        <Label
          htmlFor="payment-screenshot"
          className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-mist/40 p-4 transition-colors duration-150 hover:bg-mist focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 sm:p-5"
        >
          <Upload className="size-5 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0 break-words text-sm leading-6 text-ink-soft">
            {file ? file.name : "Tap to upload JPG, PNG, or WebP (max 4 MB)"}
          </span>
          <Input
            id="payment-screenshot"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby="payment-screenshot-label"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              if (selected && selected.size > MAX_PROOF_BYTES) {
                setFile(null);
                setError("Image is too large (max 4 MB).");
                e.target.value = "";
                return;
              }
              setFile(selected);
              setError(null);
            }}
          />
        </Label>
      </div>

      {error && (
        <p
          role="alert"
          className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        block
        loading={submitting}
        disabled={expired}
      >
        {expired ? "Hold expired" : "Submit payment"}
      </Button>
      <p className="text-center text-sm leading-6 text-muted-foreground">
        The venue confirms within their stated window — we&apos;ll notify you.
      </p>
    </form>
  );
}
