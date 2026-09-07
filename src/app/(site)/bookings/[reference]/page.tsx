import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Circle, Phone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getBookingByReference } from "@/lib/bookings-read";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { StatusTimeline } from "@/components/booking/StatusTimeline";
import { BookingStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { channelLabel } from "@/lib/payment";
import { pesos } from "@/lib/format";
import { nowMs } from "@/lib/now";
import { cn } from "@/lib/cn";
import { reviewEligibility } from "@/lib/review";
import { ReviewPrompt } from "@/components/review/ReviewPrompt";

export const metadata = { title: "Booking status" };

const STEPS = [
  { key: "selected", label: "Court selected" },
  { key: "created", label: "Reservation created" },
  { key: "paid", label: "Payment submitted" },
  { key: "awaiting", label: "Awaiting venue confirmation" },
  { key: "confirmed", label: "Confirmed" },
];

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/bookings/${reference}`);

  const b = await getBookingByReference(reference, session.id, session.role);
  if (!b) notFound();

  const paid = ["PAYMENT_SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "COMPLETED"].includes(
    b.status,
  );
  const awaiting = ["PENDING_CONFIRMATION"].includes(b.status);
  const confirmed = ["CONFIRMED", "COMPLETED"].includes(b.status);
  const done: Record<string, boolean> = {
    selected: true,
    created: true,
    paid,
    awaiting: awaiting || confirmed,
    confirmed,
  };

  const canResume =
    (b.status === "HELD" || b.status === "PENDING_PAYMENT") &&
    !!b.holdExpiresAt &&
    b.holdExpiresAt.getTime() > nowMs();

  const showReview = b.status === "COMPLETED" && b.userId === session.id;
  const eligibility = showReview ? await reviewEligibility(b.id, session.id) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Booking</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{b.reference}</h1>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>

      <div className="mt-4">
        <BookingSummary
          venueName={b.venue.name}
          courtName={b.court.name}
          startsAt={b.startsAt}
          endsAt={b.endsAt}
          priceCents={b.priceCents}
        />
      </div>

      {canResume && (
        <Link href={`/book/${b.reference}`} className="mt-4 block">
          <Button size="lg" block>
            Resume booking
          </Button>
        </Link>
      )}

      {showReview && (
        <ReviewPrompt
          bookingId={b.id}
          venueName={b.venue.name}
          existing={eligibility?.existingReview ?? null}
        />
      )}

      {/* Progress */}
      <section className="mt-6 rounded-2xl border border-black/5 p-4">
        <ul className="space-y-2.5">
          {STEPS.map((s) => {
            const isDone = done[s.key];
            const isCurrent = !isDone && s.key === (paid ? "confirmed" : "paid");
            return (
              <li key={s.key} className="flex items-center gap-2.5 text-sm">
                {isDone ? (
                  <Check className="size-5 text-brand-600" aria-hidden />
                ) : isCurrent ? (
                  <span className="grid size-5 place-items-center" aria-hidden>
                    <span className="size-2.5 animate-pulse rounded-full bg-amber-500" />
                  </span>
                ) : (
                  <Circle className="size-5 text-slate-300" aria-hidden />
                )}
                <span className={cn(isDone ? "text-ink" : "text-muted")}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Payment */}
      <section className="mt-4 rounded-2xl border border-black/5 p-4">
        <h2 className="text-sm font-semibold text-ink">Payment</h2>
        {b.payment ? (
          <p className="mt-1 text-sm text-ink-soft">
            {channelLabel(b.payment.channel)} · ref {b.payment.reference} ·{" "}
            {pesos(b.payment.amountCents)} · submitted
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Not submitted yet.</p>
        )}
      </section>

      {/* Venue contact */}
      {b.venue.contactNumber && (
        <section className="mt-4 rounded-2xl border border-black/5 p-4">
          <h2 className="text-sm font-semibold text-ink">Venue contact</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            <Phone className="size-4" aria-hidden />
            {b.venue.contactNumber}
          </p>
        </section>
      )}

      {/* History */}
      <section className="mt-4 rounded-2xl border border-black/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
        <StatusTimeline
          history={b.history.map((h) => ({ toStatus: h.toStatus, at: h.at, note: h.note }))}
        />
      </section>

      <p className="mt-4 text-center text-xs text-muted">
        Confirmation comes from the venue. Payment goes to the venue. This page is
        the neutral status both sides can check.
      </p>
    </div>
  );
}
