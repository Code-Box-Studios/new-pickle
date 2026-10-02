import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { dateLabel, timeLabel, weekdayLabel, parseIsoDate } from "@/lib/format";
import type { AgendaDay, CellState } from "@/lib/venue/ops";

const DOT: Record<CellState, string> = {
  AVAILABLE: "bg-white border border-brand-300",
  HELD: "bg-amber-400",
  PENDING: "bg-brand-teal-mid",
  CONFIRMED: "bg-brand-500",
  BLOCKED: "bg-slate-400",
  CLOSED: "bg-slate-200",
};
const STATE_LABEL: Record<CellState, string> = {
  AVAILABLE: "Open",
  HELD: "Held",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  BLOCKED: "Blocked",
  CLOSED: "Closed",
};

export function WeekAgenda({ days }: { days: AgendaDay[] }) {
  return (
    <div className="space-y-7">
      {days.map((d) => {
        const date = parseIsoDate(d.date);
        return (
          <section key={d.date}>
            <h3 className="mb-3 flex flex-wrap items-center gap-1.5 text-base font-semibold tracking-tight text-ink">
              {weekdayLabel(date)}{" "}
              <span className="text-muted-foreground">· {dateLabel(date)}</span>
            </h3>
            {d.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {d.items.map((it, i) => {
                  const body = (
                    <Card className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          DOT[it.state],
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-relaxed text-ink">
                          {timeLabel(new Date(it.startsAt))}–
                          {timeLabel(new Date(it.endsAt))} · {it.courtName}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {STATE_LABEL[it.state]} · {it.label}
                        </p>
                      </div>
                    </Card>
                  );
                  return (
                    <li key={i}>
                      {it.reference ? (
                        <Link
                          href={`/owner/reservations/${it.reference}`}
                          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
