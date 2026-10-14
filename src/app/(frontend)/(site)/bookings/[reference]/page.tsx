import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Circle, Phone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getBookingByReference } from "@/lib/bookings-read";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { StatusTimeline } from "@/components/booking/StatusTimeline";
import { BookingStatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { channelLabel } from "@/lib/payment";
import { pesos } from "@/lib/format";
import { nowMs } from "@/lib/now";
import { cn } from "@/lib/cn";
import { reviewEligibility } from "@/lib/review";
import { ReviewPrompt } from "@/components/review/ReviewPrompt";
import {
  checkoutForBooking,
  publicCheckoutStatus,
} from "@/lib/payments/paymongo/checkout";
import { PayMongoStatus } from "@/components/booking/PayMongoPayment";
import { BookingPasaloActions } from "@/components/pasalo/BookingPasaloActions";
import { PlayerRosterCard } from "@/components/players/PlayerRosterCard";
import { actualStart, CUTOFF_MS } from "@/lib/pasalo/rules";

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
  const sale = b.pasaloListing?.status === "SOLD" ? b.pasaloListing.trades[0] : null;
  const checkout = sale ? null : publicCheckoutStatus(await checkoutForBooking(b.id));
  const showHostedReceipt =
    checkout && !(b.payment && ["FAILED", "EXPIRED"].includes(checkout.status));

  const paid = [
    "PAYMENT_SUBMITTED",
    "PENDING_CONFIRMATION",
    "CONFIRMED",
    "COMPLETED",
  ].includes(b.status);
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
  const eligibility = showReview
    ? await reviewEligibility(b.id, session.id)
    : null;

  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-52">
            <p className="eyebrow">Booking</p>
            <h1 className="page-title mt-3 break-words">{b.reference}</h1>
          </div>
          <div className="shrink-0 sm:pt-1">
            <BookingStatusBadge status={b.status} />
          </div>
        </div>

        <div className="mt-7 sm:mt-8">
          <BookingSummary
            venueName={b.venue.name}
            courtName={b.court.name}
            startsAt={b.startsAt}
            endsAt={b.endsAt}
            priceCents={sale?.priceCents ?? b.priceCents}
          />
        </div>

        {canResume && (
          <Link
            href={`/book/${b.reference}`}
            className={`${buttonVariants({ size: "lg", block: true })} mt-5`}
          >
            Resume booking
          </Link>
        )}

        {showReview && (
          <ReviewPrompt
            bookingId={b.id}
            venueName={b.venue.name}
            existing={eligibility?.existingReview ?? null}
          />
        )}

        {!sale && b.userId === session.id && (
          <div className="mt-5">
            <BookingPasaloActions
              bookingId={b.id}
              originalPriceCents={b.priceCents}
              listingId={b.pasaloListing?.id}
              listingStatus={b.pasaloListing?.status}
              eligible={b.status === "CONFIRMED" && b.backendType === "LOCAL" && b.source === "ONLINE" && b.currency === "PHP" && b.venue.isPublished && b.venue.status === "APPROVED" && b.court.active && actualStart(b.startsAt) - nowMs() > CUTOFF_MS && ((b.payment?.amountCents ?? 0) >= b.priceCents || checkout?.status === "PAID")}
            />
          </div>
        )}

        {/* Progress */}
        {b.userId === session.id && <div className="mt-5"><PlayerRosterCard bookingId={b.id} compact /></div>}
        <Card className="mt-6 p-6 sm:p-7">
          <ul className="space-y-4">
            {STEPS.map((s) => {
              const isDone = done[s.key];
              const isCurrent =
                !isDone && s.key === (paid ? "confirmed" : "paid");
              return (
                <li
                  key={s.key}
                  className="flex items-center gap-3 text-sm leading-6"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? (
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-mist"
                      aria-hidden
                    >
                      <Check className="size-4 text-brand-700" />
                    </span>
                  ) : isCurrent ? (
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-50"
                      aria-hidden
                    >
                      <span className="size-2 rounded-full bg-amber-600" />
                    </span>
                  ) : (
                    <Circle className="size-7 shrink-0 text-line" aria-hidden />
                  )}
                  <span
                    className={cn(
                      isDone ? "text-ink" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Payment */}
        <Card className="mt-5 p-6 sm:p-7">
          <SectionHeader>Payment</SectionHeader>
          {sale ? (
            <div className="mt-3 space-y-3 text-sm leading-6 text-ink-soft">
              <p>Pasalo transfer · {pesos(sale.priceCents)} paid directly to the seller. The seller confirmed receipt.</p>
              <p>The venue’s original payment remains on record. Your current reservation status is shown above.</p>
              <Link href={`/pasalo/trades/${sale.id}`} className={buttonVariants({ variant: "outline" })}>View transfer receipt and conversation</Link>
            </div>
          ) : showHostedReceipt ? (
            <div className="mt-4">
              <PayMongoStatus
                key={checkout.status}
                bookingId={b.id}
                initial={checkout}
              />
            </div>
          ) : b.payment ? (
            <p className="mt-3 break-words text-sm leading-6 text-ink-soft">
              {channelLabel(b.payment.channel)} · ref {b.payment.reference} ·{" "}
              {pesos(b.payment.amountCents)} · submitted
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Not submitted yet.
            </p>
          )}
        </Card>

        {/* Venue contact */}
        {b.venue.contactNumber && (
          <Card className="mt-5 p-6 sm:p-7">
            <SectionHeader>Venue contact</SectionHeader>
            <p className="mt-3 flex items-center gap-2 text-sm leading-6 text-ink-soft">
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                {b.venue.contactNumber}
              </span>
            </p>
          </Card>
        )}

        {/* History */}
        <Card className="mt-5 p-6 sm:p-7">
          <SectionHeader className="mb-5">Activity</SectionHeader>
          <StatusTimeline
            history={b.history.map((h) => ({
              toStatus: h.toStatus,
              at: h.at,
              note: h.note,
            }))}
          />
        </Card>

        <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
          {sale ? "This booking was transferred between players through Pasalo. Your current reference is shown above." : "Confirmation comes from the venue. Payment goes to the venue. This page shows your reservation status."}
        </p>
      </div>
    </div>
  );
}
