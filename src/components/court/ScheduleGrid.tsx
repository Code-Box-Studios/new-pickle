"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Clock3, Moon, Sun, Sunset } from "lucide-react";
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
    courts.map((c) => [c.id, new Map(c.slots.map((s) => [s.startsAt, s]))]),
  );

  const gridCols = `64px repeat(${courts.length}, minmax(140px, 1fr))`;

  return (
    <Card
      className="overflow-x-auto rounded-xl border border-line bg-white"
      role="group"
      aria-label="Court times and prices"
    >
      {/* Column headers */}
      <div
        className="grid border-b border-line bg-canvas"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="grid place-items-center p-3 text-muted-foreground">
          <Clock3 className="size-4" aria-label="Start time" />
        </div>
        {courts.map((c) => {
          const closed = c.slots.length === 0;
          const full = !closed && c.slots.every((s) => !s.available);
          return (
            <div
              key={c.id}
              className="border-l border-line bg-surface-soft px-3 py-4 text-center"
            >
              <p className="text-sm font-semibold text-ink">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.indoor ? "Indoor" : "Outdoor"}
              </p>
              <p className="mt-1 text-xs font-medium text-brand-700">
                {pesos(c.priceCents)}/hr
              </p>
              {(closed || full) && (
                <span
                  className={cn(
                    "mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium",
                    closed
                      ? "bg-mist text-muted-foreground"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {closed ? "No times" : "Full"}
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
            className="grid border-b border-line bg-surface"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-brand-700"
              style={{ gridColumn: `1 / span ${courts.length + 1}` }}
            >
              {band.label === "Morning" ? (
                <Sun className="size-3.5" aria-hidden />
              ) : band.label === "Afternoon" ? (
                <Sunset className="size-3.5" aria-hidden />
              ) : (
                <Moon className="size-3.5" aria-hidden />
              )}
              {band.label}
            </div>
          </div>
          {/* Time rows */}
          {band.times.map((t) => {
            const label = timeLabel(new Date(t));
            const [hhmm, period] = label.split(" ");
            return (
              <div
                key={t}
                className="grid border-b border-line/70 last:border-b-0"
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* Time label — intentional two-line */}
                <div className="flex flex-col items-center justify-center px-2 py-3 text-center">
                  <span className="text-[13px] font-medium tabular-nums text-ink-soft leading-none">
                    {hhmm}
                  </span>
                  <span className="mt-1 text-[11px] uppercase text-muted-foreground leading-none">
                    {period}
                  </span>
                </div>
                {/* Court cells */}
                {courts.map((c) => {
                  const slot = slotMap.get(c.id)?.get(t);
                  const isSel =
                    selected?.courtId === c.id && selected?.startsAt === t;
                  return (
                    <div key={c.id} className="border-l border-line/70 p-2">
                      {slot ? (
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={isSel}
                          aria-label={`${c.name}, ${label}, ${slot.available ? pesos(slot.priceCents) : "unavailable"}`}
                          onClick={() => onSelect(c, slot)}
                          className={cn(
                            "h-12 w-full gap-2 rounded-xl border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                            !slot.available
                              ? "cursor-not-allowed border-transparent bg-canvas text-muted-foreground/60"
                              : isSel
                                ? "border-brand-700 bg-brand-700 text-white shadow-sm hover:bg-brand-700"
                                : "border-brand-200/60 bg-brand-50/60 text-brand-800 hover:border-brand-700/40 hover:bg-secondary",
                          )}
                        >
                          {isSel && <Check className="size-4" aria-hidden />}
                          {slot.available ? pesos(slot.priceCents) : "Booked"}
                        </Button>
                      ) : (
                        <div
                          className="h-11 rounded-xl bg-canvas/70"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
