import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listUserBookings } from "@/lib/bookings-read";
import { BookingStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
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
      <div className="page-shell py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="page-title">My bookings</h1>
          <EmptyState
            icon={<CalendarCheck className="size-7" />}
            title="You don't have any bookings yet"
            description="Find a court and reserve your next game."
            action={{ label: "Find a court", href: "/search" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="page-title">My bookings</h1>

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
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 sm:mt-10">
      <SectionHeader className="mb-4">{title}</SectionHeader>
      <ul className="space-y-4">{children}</ul>
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
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-44">
            <p className="break-words text-lg font-semibold tracking-tight text-ink">
              {b.venue.name}
            </p>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
              {b.court.name}
            </p>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              {dateLabel(b.startsAt)} · {timeLabel(b.startsAt)} –{" "}
              {timeLabel(b.endsAt)} · {pesos(b.priceCents)}
            </p>
          </div>
          <div className="shrink-0">
            <BookingStatusBadge status={b.status} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/bookings/${b.reference}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View
          </Link>
          {canResume && (
            <Link
              href={`/book/${b.reference}`}
              className={buttonVariants({ size: "sm" })}
            >
              Resume
            </Link>
          )}
        </div>
      </Card>
    </li>
  );
}
