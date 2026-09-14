"use client";

import { cn } from "@/lib/cn";
import { pesos, timeLabel } from "@/lib/format";
import type { CourtDTO, SlotDTO } from "@/components/court/CourtBooking";

type Selection = {
  courtId: string;
  startsAt: string;
  courtName: string;
  priceCents: number;
} | null;

type Band = { label: string; times: string[] };

/** Returns a union of all slot start-time ISO strings across all courts, sorted. */
function allTimes(courts: CourtDTO[]): string[] {
  const set = new Set<string>();
  for (const c of courts) {
    for (const s of c.slots) set.add(s.startsAt);
  }
  return Array.from(set).sort();
}

/** Groups sorted ISO time strings into Morning/Afternoon/Evening bands. */
function toBands(times: string[]): Band[] {
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];
  for (const t of times) {
    const hour = new Date(t).getUTCHours();
    if (hour < 12) morning.push(t);
    else if (hour < 17) afternoon.push(t);
    else evening.push(t);
  }
  return [
    { label: "Morning", times: morning },
    { label: "Afternoon", times: afternoon },
    { label: "Evening", times: evening },
  ].filter((b) => b.times.length > 0);
}

export function ScheduleGrid({
  courts,
  selected,
  onSelect,
}: {
  courts: CourtDTO[];
  selected: Selection;
  onSelect: (court: CourtDTO, slot: SlotDTO) => void;
}) {
  const times = allTimes(courts);
  const bands = toBands(times);

  // Build a lookup: courtId → Map(startsAt → SlotDTO)
  const slotMap = new Map(
    courts.map((c) => [c.id, new Map(c.slots.map((s) => [s.startsAt, s]))])
  );

  const gridCols = `64px repeat(${courts.length}, minmax(90px, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5">
      {/* Column headers */}
      <div
        className="grid border-b border-black/5 bg-slate-50"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="p-3" /> {/* time column */}
        {courts.map((c) => {
          const closed = c.slots.length === 0;
          const full = !closed && c.slots.every((s) => !s.available);
          return (
            <div
              key={c.id}
              className="border-l border-black/5 p-3 text-center"
            >
              <p className="text-[13px] font-semibold text-ink">{c.name}</p>
              <p className="text-[11px] text-muted">
                {c.indoor ? "Indoor" : "Outdoor"} · {pesos(c.priceCents)}/hr
              </p>
              {(closed || full) && (
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                    closed
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {closed ? "Closed" : "Full"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Band rows */}
      {bands.map((band) => (
        <div key={band.label}>
          {/* Band label row */}
          <div
            className="grid border-b border-black/5 bg-brand-50/40"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div
              className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700"
              style={{ gridColumn: `1 / span ${courts.length + 1}` }}
            >
              {band.label}
            </div>
          </div>
          {/* Time rows */}
          {band.times.map((t) => (
            <div
              key={t}
              className="grid border-b border-black/5 last:border-b-0"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Time label */}
              <div className="flex items-center px-3 py-2 text-[12px] text-muted tabular-nums">
                {timeLabel(new Date(t))}
              </div>
              {/* Court cells */}
              {courts.map((c) => {
                const slot = slotMap.get(c.id)?.get(t);
                const isSel =
                  selected?.courtId === c.id && selected?.startsAt === t;
                return (
                  <div
                    key={c.id}
                    className="border-l border-black/5 p-1.5"
                  >
                    {slot ? (
                      <button
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={isSel}
                        onClick={() => onSelect(c, slot)}
                        className={cn(
                          "h-10 w-full rounded-xl text-[12px] font-medium tabular-nums transition",
                          !slot.available
                            ? "cursor-not-allowed bg-slate-50 text-slate-300 line-through"
                            : isSel
                              ? "bg-brand-600 text-white shadow-sm"
                              : "bg-brand-50 text-brand-800 hover:bg-brand-100",
                        )}
                      >
                        <span className="block leading-tight">
                          {timeLabel(new Date(t))}
                        </span>
                        <span className="block leading-tight text-[10px] opacity-75">
                          {slot.available ? pesos(slot.priceCents) : "—"}
                        </span>
                      </button>
                    ) : (
                      <div className="h-10 rounded-xl bg-slate-50" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
