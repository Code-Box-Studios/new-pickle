"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HoldCountdown, useCountdown } from "./HoldCountdown";
import { pesos } from "@/lib/format";
import type { PaymentCheckoutStatus } from "@/generated/prisma";

export interface CheckoutStatusDTO {
  status: PaymentCheckoutStatus;
  testMode: boolean;
  amountCents: number;
  paymentReference: string | null;
  paidAt: string | null;
}
const LABELS = { gcash: "GCash", paymaya: "Maya", qrph: "QR Ph" };

export function PayMongoStatus({
  bookingId,
  initial,
}: {
  bookingId: string;
  initial: CheckoutStatusDTO;
}) {
  const router = useRouter();
  const [checkout, setCheckout] = useState(initial);
  const [checking, setChecking] = useState(
    ["PENDING", "CREATING"].includes(initial.status),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!["PENDING", "CREATING"].includes(initial.status)) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll(attempt: number) {
      try {
        const response = await fetch(
          `/api/bookings/${bookingId}/checkout/status`,
          { method: "POST", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || !data.checkout)
          throw new Error(data.error ?? "Payment is not confirmed yet.");
        if (stopped) return;
        setCheckout(data.checkout);
        if (data.checkout.status === "PAID") {
          setChecking(false);
          router.refresh();
          return;
        }
        if (
          attempt < 4 &&
          ["PENDING", "CREATING"].includes(data.checkout.status)
        ) {
          timer = setTimeout(() => void poll(attempt + 1), 5000);
          return;
        }
      } catch (err) {
        if (!stopped)
          setError(
            err instanceof Error ? err.message : "Unable to check payment.",
          );
      }
      if (!stopped) setChecking(false);
    }
    void poll(1);
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [bookingId, initial.status, router]);
  async function retry() {
    setChecking(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/checkout/status`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.checkout)
        throw new Error(data.error ?? "Unable to check payment.");
      setCheckout(data.checkout);
      if (data.checkout.status === "PAID") router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check payment.");
    } finally {
      setChecking(false);
    }
  }
  const paid = checkout.status === "PAID",
    review = checkout.status === "REVIEW";
  const ended = ["FAILED", "EXPIRED"].includes(checkout.status);
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          {paid ? (
            <CheckCircle2
              aria-hidden
              className="mt-1 size-5 shrink-0 text-brand-700"
            />
          ) : (
            <ShieldCheck
              aria-hidden
              className="mt-1 size-5 shrink-0 text-brand-700"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">
              {paid
                ? "Payment verified"
                : review
                  ? "Payment needs a review"
                  : ended
                    ? "Online checkout ended"
                    : checking
                      ? "Checking your payment"
                      : "Payment not confirmed yet"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {paid
                ? "Payment was received by the venue's payment account. Payment and reservation confirmation are separate; check your booking status below."
                : review
                  ? "Contact the venue with your booking reference before paying again. A payment review does not confirm this reservation."
                  : ended
                    ? "This checkout cannot be used again. Check your booking and contact the venue if your wallet was charged."
                    : "We are checking with PayMongo. Returning from checkout does not confirm payment. Please avoid paying again until the status is clear."}
            </p>
            {checkout.paymentReference && (
              <p className="mt-3 break-all text-sm text-ink-soft">
                Receipt: {checkout.paymentReference}
              </p>
            )}
            {checkout.testMode && (
              <p className="mt-3 text-xs font-semibold text-brand-700">
                Test payment · sandbox only, no real funds
              </p>
            )}
          </div>
        </div>
      </div>
      {!paid && (
        <Button
          type="button"
          variant="outline"
          block
          loading={checking}
          loadingLabel="Checking payment"
          onClick={retry}
        >
          <RefreshCw aria-hidden className="size-4" />
          Check payment status
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm leading-6 text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

export function PayMongoPayment({
  bookingId,
  reference,
  expiresAt,
  amountCents,
  venueName,
  methods,
  testMode,
  checkoutEnabled,
  initial,
}: {
  bookingId: string;
  reference: string;
  expiresAt: string;
  amountCents: number;
  venueName: string;
  methods: readonly (keyof typeof LABELS)[];
  testMode: boolean;
  checkoutEnabled: boolean;
  initial?: CheckoutStatusDTO | null;
}) {
  const router = useRouter(),
    { expired } = useCountdown(expiresAt);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/checkout`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? "Please check your booking before trying again.",
        );
      if (typeof data.next === "string" && data.next.startsWith("/bookings/")) {
        router.push(data.next);
        return;
      }
      const url = new URL(data.checkoutUrl);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "checkout.paymongo.com" ||
        url.port ||
        url.username ||
        url.password
      )
        throw new Error("Unable to open secure checkout.");
      window.location.assign(url.toString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Please check payment status before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const resumable = !initial || initial.status === "PENDING";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">A little closer to game time</h2>
        <HoldCountdown expiresAt={expiresAt} />
      </div>
      <Card className="space-y-4 border-brand-100 bg-brand-50 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-white">
            <Wallet aria-hidden className="size-5 text-brand-700" />
          </span>
          <span className="min-w-0 text-sm text-ink-soft">
            Pay <strong className="break-words">{venueName}</strong>
          </span>
        </div>
        <p className="text-3xl font-medium tracking-tight text-ink">
          {pesos(amountCents)}
        </p>
        <div
          className="flex flex-wrap gap-2"
          aria-label="Available payment methods"
        >
          {methods.map((method) => (
            <span
              key={method}
              className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink"
            >
              {LABELS[method]}
            </span>
          ))}
        </div>
        {testMode && (
          <p className="text-sm font-semibold text-brand-700">
            Test payment · sandbox only, no real funds
          </p>
        )}
      </Card>
      {initial && (
        <PayMongoStatus
          key={initial.status}
          bookingId={bookingId}
          initial={initial}
        />
      )}
      {resumable && checkoutEnabled && (
        <>
          <Button
            type="button"
            size="lg"
            block
            loading={busy}
            loadingLabel="Opening secure checkout"
            disabled={expired}
            onClick={pay}
          >
            <LockKeyhole aria-hidden className="size-4" />
            {expired
              ? "Hold expired"
              : initial
                ? "Return to secure payment"
                : "Continue to secure payment"}
            <ArrowUpRight aria-hidden className="size-4" />
          </Button>
          <p className="text-center text-sm leading-6 text-muted-foreground">
            Pay securely with PayMongo. No screenshot needed. The venue confirms
            your reservation after payment.
          </p>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-4 text-sm leading-6 text-ink-soft"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        <Link
          className="font-medium text-brand-700 underline underline-offset-4"
          href={`/bookings/${reference}`}
        >
          View booking status
        </Link>
        {!initial && (
          <Link
            className="font-medium text-brand-700 underline underline-offset-4"
            href={`/book/${reference}?payment=manual`}
          >
            Pay the venue another way
          </Link>
        )}
      </div>
    </div>
  );
}
