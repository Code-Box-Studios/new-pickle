import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, CalendarDays, CircleDollarSign, Clock, LayoutGrid, Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveOwnerVenues } from "@/lib/venue/owner-context";
import { ownerDaySchedule } from "@/lib/venue/ops";
import { OCCUPYING } from "@/lib/booking/status";
import { VenueSwitcher } from "@/components/owner/VenueSwitcher";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { BookingStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { pesos, dateLabel, timeLabel } from "@/lib/format";
import { nowDate } from "@/lib/now";

export const metadata = { title: "Dashboard" };

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/owner");
  const sp = await searchParams;
  const { venues, active } = await resolveOwnerVenues(session, sp.venue);

  if (!active) {
    return (
      <EmptyState
        icon={<LayoutGrid className="size-7" />}
        title="No venues yet"
        description="List your first venue to start taking bookings."
        action={{ label: "List your venue", href: "/list-your-venue" }}
      />
    );
  }

  const now = nowDate();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const venueId = active.id;

  const [pendingCount, todayCount, activeCourts, revenue, pendingList, upcoming, sched] =
    await Promise.all([
      prisma.booking.count({ where: { venueId, status: "PENDING_CONFIRMATION" } }),
      prisma.booking.count({ where: { venueId, status: { in: OCCUPYING }, startsAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.court.count({ where: { venueId, active: true } }),
      prisma.booking.aggregate({
        _sum: { priceCents: true },
        where: { venueId, status: { in: ["CONFIRMED", "COMPLETED"] }, startsAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.booking.findMany({
        where: { venueId, status: "PENDING_CONFIRMATION" },
        include: { court: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      prisma.booking.findMany({
        where: { venueId, status: { in: OCCUPYING }, startsAt: { gte: now } },
        include: { court: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      active.status === "APPROVED" ? ownerDaySchedule(venueId, now) : Promise.resolve(null),
    ]);

  let occupancy = "—";
  if (sched) {
    const cells = sched.courts.flatMap((c) => c.cells);
    const open = cells.filter((c) => c.state !== "CLOSED").length;
    const busy = cells.filter((c) => ["HELD", "PENDING", "CONFIRMED"].includes(c.state)).length;
    occupancy = open > 0 ? `${Math.round((busy / open) * 100)}%` : "—";
  }

  const live = active.isPublished && active.status === "APPROVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Good day 👋</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{active.name}</h1>
            <VenueStatusBadge status={active.status} />
            {active.status === "APPROVED" && (
              <span className="text-xs font-medium text-muted">{live ? "· Live" : "· Not published"}</span>
            )}
          </div>
        </div>
        <VenueSwitcher venues={venues} activeId={active.id} />
      </div>

      {active.status !== "APPROVED" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This venue isn&apos;t approved yet. Finish setup and get it approved to start taking
          bookings.{" "}
          <Link href={`/owner/venues/${active.id}/review`} className="font-semibold underline">
            Go to setup
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat icon={<CalendarDays className="size-4" />} label="Today" value={`${todayCount}`} />
            <Stat icon={<Clock className="size-4" />} label="Pending" value={`${pendingCount}`} />
            <Stat icon={<LayoutGrid className="size-4" />} label="Courts" value={`${activeCourts}`} />
            <Stat icon={<CircleDollarSign className="size-4" />} label="Revenue" value={pesos(revenue._sum.priceCents ?? 0)} />
            <Stat icon={<LayoutGrid className="size-4" />} label="Occupancy" value={occupancy} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/owner/calendar?venue=${venueId}`}>
              <Button><CalendarDays className="size-4" /> Open calendar</Button>
            </Link>
            <Link href={`/owner/calendar?venue=${venueId}&new=1`}>
              <Button variant="secondary"><Plus className="size-4" /> New booking</Button>
            </Link>
            <Link href={`/owner/calendar?venue=${venueId}&block=1`}>
              <Button variant="outline"><Ban className="size-4" /> Block court</Button>
            </Link>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Needs confirmation ({pendingCount})
            </h2>
            {pendingList.length === 0 ? (
              <p className="text-sm text-muted">Nothing waiting on you. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {pendingList.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{b.customerName ?? "Guest"}</p>
                      <p className="text-sm text-muted">
                        {b.court.name} · {dateLabel(b.startsAt)} {timeLabel(b.startsAt)}
                      </p>
                    </div>
                    <Link href={`/owner/reservations/${b.reference}`}>
                      <Button size="sm">Review</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No upcoming bookings.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{b.customerName ?? "Guest"}</p>
                      <p className="text-sm text-muted">
                        {b.court.name} · {dateLabel(b.startsAt)} {timeLabel(b.startsAt)}–{timeLabel(b.endsAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookingStatusBadge status={b.status} />
                      <Link href={`/owner/reservations/${b.reference}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
