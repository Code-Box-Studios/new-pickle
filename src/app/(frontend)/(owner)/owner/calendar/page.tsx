import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { resolveOwnerVenues } from "@/lib/venue/owner-context";
import { ownerDaySchedule, ownerWeekAgenda } from "@/lib/venue/ops";
import { VenueSwitcher } from "@/components/owner/VenueSwitcher";
import { CalendarBoard } from "@/components/owner/CalendarBoard";
import { WeekAgenda } from "@/components/owner/WeekAgenda";
import { EmptyState } from "@/components/ui/states";
import { Legend } from "@/components/ui/legend";
import { cn } from "@/lib/cn";
import { isoDate, longDateLabel, parseIsoDate } from "@/lib/format";
import { nowDate } from "@/lib/now";

export const metadata = { title: "Calendar" };

function shiftIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
function mondayOf(iso: string): Date {
  const d = parseIsoDate(iso);
  const offset = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    venue?: string;
    date?: string;
    view?: string;
    new?: string;
    block?: string;
  }>;
}) {
  const session = await getOwnerPageSession();
  if (!session) redirect("/login?next=/owner/calendar");
  const sp = await searchParams;
  const { venues, active } = await resolveOwnerVenues(session, sp.venue);

  if (!active) {
    return (
      <EmptyState
        icon={<LayoutGrid className="size-7" />}
        title="No venues yet"
        description="List a venue to use the calendar."
        action={{ label: "List your venue", href: "/list-your-venue" }}
      />
    );
  }
  if (active.status !== "APPROVED") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This venue isn&apos;t approved yet — the calendar activates once
        it&apos;s approved.{" "}
        <Link
          href={`/owner/venues/${active.id}/review`}
          className="font-semibold underline"
        >
          Go to setup
        </Link>
      </div>
    );
  }

  const view = sp.view === "week" ? "week" : "day";
  const dateIso = sp.date ?? isoDate(nowDate());
  const base = (params: Record<string, string>) => {
    const p = new URLSearchParams({
      venue: active.id,
      view,
      date: dateIso,
      ...params,
    });
    return `/owner/calendar?${p.toString()}`;
  };

  const daySched =
    view === "day"
      ? await ownerDaySchedule(active.id, parseIsoDate(dateIso))
      : null;
  const weekDays =
    view === "week"
      ? await ownerWeekAgenda(active.id, mondayOf(dateIso))
      : null;

  return (
    <div className="space-y-6 pb-24 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Calendar</h1>
        <VenueSwitcher venues={venues} activeId={active.id} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Calendar view"
          className="inline-flex gap-1 rounded-lg border border-line bg-surface p-1.5"
        >
          <Button
            asChild
            variant="ghost"
            className={cn(
              "h-auto p-0",
              "flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              view === "day"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-ink-soft hover:bg-canvas",
            )}
          >
            <Link
              href={base({ view: "day" })}
              aria-current={view === "day" ? "page" : undefined}
            >
              Day
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className={cn(
              "h-auto p-0",
              "flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              view === "week"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-ink-soft hover:bg-canvas",
            )}
          >
            <Link
              href={base({ view: "week" })}
              aria-current={view === "week" ? "page" : undefined}
            >
              Week
            </Link>
          </Button>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="motion-trigger"
          >
            <Link
              href={base({
                date: shiftIso(dateIso, view === "week" ? -7 : -1),
              })}
              aria-label="Previous"
            >
              <ChevronLeft
                className="motion-arrow size-4"
                data-direction="left"
                aria-hidden
              />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className={cn(
              "h-auto p-0",
              "flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            )}
          >
            <Link href={base({ date: isoDate(nowDate()) })}>Today</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="motion-trigger"
          >
            <Link
              href={base({ date: shiftIso(dateIso, view === "week" ? 7 : 1) })}
              aria-label="Next"
            >
              <ChevronRight
                className="motion-arrow size-4"
                data-direction="right"
                aria-hidden
              />
            </Link>
          </Button>
        </div>
      </div>

      {view === "week" && (
        <Legend
          items={[
            {
              dotClass: "bg-white border border-dashed border-brand-300",
              label: "Available",
            },
            { dotClass: "bg-amber-300", label: "Held" },
            { dotClass: "bg-brand-teal-mid", label: "Pending" },
            { dotClass: "bg-brand-500", label: "Confirmed" },
            { dotClass: "bg-slate-400", label: "Blocked" },
            { dotClass: "bg-slate-200", label: "Closed" },
          ]}
        />
      )}

      {daySched ? (
        <>
          <p className="text-base font-semibold tracking-tight text-ink">
            {longDateLabel(parseIsoDate(dateIso))}
          </p>
          <CalendarBoard
            venueId={active.id}
            dateIso={dateIso}
            openMinute={daySched.openMinute}
            closeMinute={daySched.closeMinute}
            courts={daySched.courts}
            autoOpen={
              sp.new === "1" ? "new" : sp.block === "1" ? "block" : undefined
            }
          />
        </>
      ) : weekDays ? (
        <WeekAgenda days={weekDays} />
      ) : null}
    </div>
  );
}
