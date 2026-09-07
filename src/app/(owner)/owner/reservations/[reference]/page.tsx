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
    <div className="mx-auto max-w-2xl">
      <Link
        href="/owner/reservations"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Reservations
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reservation</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{b.reference}</h1>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>

      {/* Customer */}
      <section className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Customer</h2>
        <p className="mt-1 font-medium text-ink">{b.customerName ?? b.user?.name ?? "Guest"}</p>
        <div className="mt-1 space-y-0.5 text-sm text-ink-soft">
          {b.customerMobile && (
            <p className="flex items-center gap-2">
              <Phone className="size-4" aria-hidden /> {b.customerMobile}
            </p>
          )}
          {(b.customerEmail || b.user?.email) && (
            <p className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden /> {b.customerEmail ?? b.user?.email}
            </p>
          )}
        </div>
      </section>

      <div className="mt-4">
        <BookingSummary
          venueName={b.venue.name}
          courtName={b.court.name}
          startsAt={b.startsAt}
          endsAt={b.endsAt}
          priceCents={b.priceCents}
        />
      </div>

      {(b.source === "WALK_IN" || b.note) && (
        <p className="mt-2 text-sm text-muted">
          {b.source === "WALK_IN" ? "Walk-in" : "Note"}
          {b.note ? ` · ${b.note}` : ""}
        </p>
      )}

      {/* Payment proof */}
      <section className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Payment proof</h2>
        {b.payment ? (
          <div className="mt-2">
            <p className="text-sm text-ink-soft">
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
      </section>

      {actionable && (
        <section className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="mb-3 text-sm text-ink-soft">
            Review the payment above, then confirm or reject this reservation.
          </p>
          <ConfirmRejectActions bookingId={b.id} />
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Manage</h2>
        <ManageActions
          bookingId={b.id}
          status={b.status}
          startsAtIso={b.startsAt.toISOString()}
          durationMinutes={Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000)}
        />
      </section>

      <section className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
        <StatusTimeline
          history={b.history.map((h) => ({ toStatus: h.toStatus, at: h.at, note: h.note }))}
        />
      </section>
    </div>
  );
}
