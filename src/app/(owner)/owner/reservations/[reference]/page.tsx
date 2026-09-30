import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { StatusTimeline } from "@/components/booking/StatusTimeline";
import { BookingStatusBadge } from "@/components/ui/badge";
import { ConfirmRejectActions } from "@/components/owner/ConfirmRejectActions";
import { ManageActions } from "@/components/owner/ManageActions";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { channelLabel } from "@/lib/payment";
import { pesos } from "@/lib/format";

export const metadata = { title: "Reservation" };

export default async function OwnerReservationDetail({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const session = await getSession();
  if (!session) redirect("/login?next=/owner");

  const b = await prisma.booking.findUnique({
    where: { reference },
    include: {
      venue: true,
      court: true,
      payment: true,
      user: { select: { name: true, email: true, mobile: true } },
      history: { orderBy: { at: "asc" } },
    },
  });
  if (!b) notFound();

  const ids = await accessibleVenueIds(session.id, session.role);
  if (!ids.includes(b.venueId)) notFound();

  const actionable = b.status === "PENDING_CONFIRMATION" || b.status === "PAYMENT_SUBMITTED";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/owner/reservations"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="size-4" aria-hidden /> Reservations
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Reservation</p>
          <h1 className="page-title break-all">{b.reference}</h1>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>

      {/* Customer */}
      <Card className="mt-6 p-5 sm:p-6">
        <SectionHeader>Customer</SectionHeader>
        <p className="mt-4 text-lg font-semibold text-ink">{b.customerName ?? b.user?.name ?? "Guest"}</p>
        <div className="mt-3 space-y-2 text-sm text-ink-soft">
          {b.customerMobile && (
            <p className="flex items-center gap-3">
              <Phone className="size-4 shrink-0 text-muted" aria-hidden /> {b.customerMobile}
            </p>
          )}
          {(b.customerEmail || b.user?.email) && (
            <p className="flex min-w-0 items-center gap-3">
              <Mail className="size-4 shrink-0 text-muted" aria-hidden /> <span className="break-all">{b.customerEmail ?? b.user?.email}</span>
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <SectionHeader className="mb-3">Booking</SectionHeader>
        <BookingSummary
          venueName={b.venue.name}
          courtName={b.court.name}
          startsAt={b.startsAt}
          endsAt={b.endsAt}
          priceCents={b.priceCents}
        />
      </Card>

      {(b.source === "WALK_IN" || b.note) && (
        <p className="mt-2 text-sm text-muted">
          {b.source === "WALK_IN" ? "Walk-in" : "Note"}
          {b.note ? ` · ${b.note}` : ""}
        </p>
      )}

      {/* Payment proof */}
      <Card className="mt-5 p-5 sm:p-6">
        <SectionHeader>Payment proof</SectionHeader>
        {b.payment ? (
          <div className="mt-2">
            <p className="break-words text-sm leading-relaxed text-ink-soft">
              {channelLabel(b.payment.channel)} · ref {b.payment.reference} ·{" "}
              {pesos(b.payment.amountCents)}
            </p>
            <a
              href={`/api/proofs/${b.payment.proofKey}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/proofs/${b.payment.proofKey}`}
                alt="Payment screenshot"
                className="max-h-96 w-full rounded-xl border border-black/5 object-contain"
              />
            </a>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">No payment submitted yet.</p>
        )}
      </Card>

      {actionable && (
        <Card className="mt-5 border-brand-200 bg-mist p-5 sm:p-6">
          <SectionHeader className="mb-3">Action required</SectionHeader>
          <p className="mb-3 text-sm text-ink-soft">
            Review the payment above, then confirm or reject this reservation.
          </p>
          <ConfirmRejectActions bookingId={b.id} />
        </Card>
      )}

      <Card className="mt-5 p-5 sm:p-6">
        <SectionHeader className="mb-3">Manage</SectionHeader>
        <ManageActions
          bookingId={b.id}
          status={b.status}
          startsAtIso={b.startsAt.toISOString()}
          durationMinutes={Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000)}
        />
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <SectionHeader className="mb-3">Activity</SectionHeader>
        <StatusTimeline
          history={b.history.map((h) => ({ toStatus: h.toStatus, at: h.at, note: h.note }))}
        />
      </Card>
    </div>
  );
}
