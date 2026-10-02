import { Button } from "@/components/ui/button";
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
  const filter =
    sp.status && STATUSES[sp.status] !== undefined ? sp.status : "action";

  const ids = await accessibleVenueIds(session.id, session.role);
  const statuses = STATUSES[filter];
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: { in: ids },
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: { venue: true, court: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="page-title">Reservations</h1>

      <div className="mt-6 overflow-x-auto pb-1">
        <nav
          aria-label="Reservation status"
          className="inline-flex min-w-max gap-1 rounded-lg border border-line bg-surface p-1.5 text-sm font-medium"
        >
          {(["action", "confirmed", "all"] as const).map((f) => (
            <Button
              key={f}
              asChild
              variant="ghost"
              className={cn(
                "h-auto p-0",
                "flex min-h-11 items-center rounded-xl px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                filter === f
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-ink-soft hover:bg-canvas",
              )}
            >
              <Link
                href={`/owner/reservations?status=${f}`}
                aria-current={filter === f ? "page" : undefined}
              >
                {f === "action"
                  ? "Needs action"
                  : f === "confirmed"
                    ? "Confirmed"
                    : "All"}
              </Link>
            </Button>
          ))}
        </nav>
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
        <ul className="mt-6 space-y-3">
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
