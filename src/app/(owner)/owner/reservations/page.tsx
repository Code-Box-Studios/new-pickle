import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { ReservationRow } from "@/components/owner/ReservationRow";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/generated/prisma";

export const metadata = { title: "Reservations" };

const STATUSES: Record<string, BookingStatus[] | null> = {
  action: ["PENDING_CONFIRMATION", "PAYMENT_SUBMITTED"],
  confirmed: ["CONFIRMED"],
  all: null,
};

export default async function OwnerReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/owner");
  const sp = await searchParams;
  const filter = sp.status && STATUSES[sp.status] !== undefined ? sp.status : "action";

  const ids = await accessibleVenueIds(session.id, session.role);
  const statuses = STATUSES[filter];
  const bookings = await prisma.booking.findMany({
    where: { venueId: { in: ids }, ...(statuses ? { status: { in: statuses } } : {}) },
    include: { venue: true, court: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Reservations</h1>

      <div className="mt-4">
        <div className="inline-flex overflow-hidden rounded-xl border border-black/10 bg-white text-sm font-medium">
          {(["action", "confirmed", "all"] as const).map((f) => (
            <Link
              key={f}
              href={`/owner/reservations?status=${f}`}
              className={cn(
                "px-4 py-2 transition",
                filter === f ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-black/5",
              )}
            >
              {f === "action" ? "Needs action" : f === "confirmed" ? "Confirmed" : "All"}
            </Link>
          ))}
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="Nothing here"
          description={
            filter === "action"
              ? "No reservations are waiting on you right now."
              : "No reservations match this filter yet."
          }
        />
      ) : (
        <ul className="mt-5 space-y-3">
          {bookings.map((b) => (
            <ReservationRow
              key={b.id}
              b={{
                reference: b.reference,
                status: b.status,
                startsAt: b.startsAt,
                endsAt: b.endsAt,
                priceCents: b.priceCents,
                customerName: b.customerName,
                venueName: b.venue.name,
                courtName: b.court.name,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
