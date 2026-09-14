import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { getSession } from "@/lib/auth/session";
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
  searchParams: Promise<{ venue?: string; date?: string; view?: string; new?: string; block?: string }>;
}) {
  const session = await getSession();
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This venue isn&apos;t approved yet — the calendar activates once it&apos;s approved.{" "}
        <Link href={`/owner/venues/${active.id}/review`} className="font-semibold underline">Go to setup</Link>
      </div>
    );
  }

  const view = sp.view === "week" ? "week" : "day";
  const dateIso = sp.date ?? isoDate(nowDate());
  const base = (params: Record<string, string>) => {
    const p = new URLSearchParams({ venue: active.id, view, date: dateIso, ...params });
    return `/owner/calendar?${p.toString()}`;
  };

  const daySched = view === "day" ? await ownerDaySchedule(active.id, parseIsoDate(dateIso)) : null;
  const weekDays = view === "week" ? await ownerWeekAgenda(active.id, mondayOf(dateIso)) : null;

  return (
    <div className="space-y-4 pb-28 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Calendar</h1>
        <VenueSwitcher venues={venues} activeId={active.id} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-xl ring-1 ring-black/10">
          <Link href={base({ view: "day" })} className={cn("px-3 py-1.5 text-sm font-medium", view === "day" ? "bg-brand-600 text-white" : "bg-white text-ink-soft")}>Day</Link>
          <Link href={base({ view: "week" })} className={cn("px-3 py-1.5 text-sm font-medium", view === "week" ? "bg-brand-600 text-white" : "bg-white text-ink-soft")}>Week</Link>
        </div>
        <div className="flex items-center gap-1">
          <Link href={base({ date: shiftIso(dateIso, view === "week" ? -7 : -1) })} className="grid size-9 place-items-center rounded-lg ring-1 ring-black/10 hover:bg-black/5" aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={base({ date: isoDate(nowDate()) })} className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-black/10 hover:bg-black/5">Today</Link>
          <Link href={base({ date: shiftIso(dateIso, view === "week" ? 7 : 1) })} className="grid size-9 place-items-center rounded-lg ring-1 ring-black/10 hover:bg-black/5" aria-label="Next">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <Legend
        items={[
          { dotClass: "bg-white border border-dashed border-brand-500", label: "Available" },
          { dotClass: "bg-amber-100", label: "Held" },
          { dotClass: "bg-sky-100", label: "Pending" },
          { dotClass: "bg-brand-100", label: "Confirmed" },
          { dotClass: "bg-slate-200", label: "Blocked" },
          { dotClass: "bg-slate-50 border border-black/5", label: "Closed" },
        ]}
      />

      {daySched ? (
        <>
          <p className="text-sm text-muted">{longDateLabel(parseIsoDate(dateIso))}</p>
          <CalendarBoard
            venueId={active.id}
            dateIso={dateIso}
            openMinute={daySched.openMinute}
            closeMinute={daySched.closeMinute}
            courts={daySched.courts}
            autoOpen={sp.new === "1" ? "new" : sp.block === "1" ? "block" : undefined}
          />
        </>
      ) : weekDays ? (
        <WeekAgenda days={weekDays} />
      ) : null}
    </div>
  );
}
