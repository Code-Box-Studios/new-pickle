import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listUserBookings } from "@/lib/bookings-read";
import { BookingStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dateLabel, pesos, timeLabel } from "@/lib/format";
import { nowMs } from "@/lib/now";

export const metadata = { title: "My bookings" };

export default async function MyBookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/bookings");

  const bookings = await listUserBookings(session.id);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const upcoming = bookings.filter((b) => b.startsAt >= startOfToday);
  const past = bookings.filter((b) => b.startsAt < startOfToday);

  if (bookings.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">My bookings</h1>
        <EmptyState
          icon={<CalendarCheck className="size-7" />}
          title="You don't have any bookings yet"
          description="Find a court and reserve your next game."
          action={{ label: "Find a court", href: "/search" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">My bookings</h1>

      {upcoming.length > 0 && (
        <Section title="Upcoming">
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} resumable />
          ))}
        </Section>
      )}
      {past.length > 0 && (
        <Section title="Past">
          {past.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

type Row = {
  id: string;
  reference: string;
  status: import("@/generated/prisma").BookingStatus;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  holdExpiresAt: Date | null;
  venue: { name: string; slug: string };
  court: { name: string };
};

function BookingRow({ b, resumable }: { b: Row; resumable?: boolean }) {
  const canResume =
    resumable &&
    (b.status === "HELD" || b.status === "PENDING_PAYMENT") &&
    !!b.holdExpiresAt &&
    b.holdExpiresAt.getTime() > nowMs();

  return (
    <li>
      <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{b.venue.name}</p>
          <p className="text-sm text-muted">{b.court.name}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {dateLabel(b.startsAt)} · {timeLabel(b.startsAt)} – {timeLabel(b.endsAt)} ·{" "}
            {pesos(b.priceCents)}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>
      <div className="mt-3 flex gap-2">
        <Link href={`/bookings/${b.reference}`}>
          <Button variant="outline" size="sm">
            View
          </Button>
        </Link>
        {canResume && (
          <Link href={`/book/${b.reference}`}>
            <Button size="sm">Resume</Button>
          </Link>
        )}
      </div>
      </Card>
    </li>
  );
}
