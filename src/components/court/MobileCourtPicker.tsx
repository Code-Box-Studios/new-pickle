"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { pesos, timeLabel } from "@/lib/format";
import type { CourtDTO, SlotDTO } from "@/components/court/CourtBooking";

type Selection = {
  courtId: string;
  startsAt: string;
  courtName: string;
  priceCents: number;
} | null;

type Band = { label: string; slots: SlotDTO[] };

function toBands(slots: SlotDTO[]): Band[] {
  const morning: SlotDTO[] = [];
  const afternoon: SlotDTO[] = [];
  const evening: SlotDTO[] = [];
  for (const s of slots) {
    const hour = new Date(s.startsAt).getUTCHours();
    if (hour < 12) morning.push(s);
    else if (hour < 17) afternoon.push(s);
    else evening.push(s);
  }
  return [
    { label: "Morning", slots: morning },
    { label: "Afternoon", slots: afternoon },
    { label: "Evening", slots: evening },
  ].filter((b) => b.slots.length > 0);
}

export function MobileCourtPicker({
  courts,
  selected,
  onSelect,
}: {
  courts: CourtDTO[];
  selected: Selection;
  onSelect: (court: CourtDTO, slot: SlotDTO) => void;
}) {
  const defaultCourt =
    courts.find((c) => c.slots.some((s) => s.available)) ?? courts[0];
  const [activeId, setActiveId] = useState<string>(defaultCourt?.id ?? "");

  const activeCourt = courts.find((c) => c.id === activeId) ?? courts[0];
  const bands = activeCourt ? toBands(activeCourt.slots) : [];

  return (
    <div className="space-y-5">
      {/* Court selector chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Choose a court">
        {courts.map((c) => {
          const closed = c.slots.length === 0;
          const full = !closed && c.slots.every((s) => !s.available);
          const isActive = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                isActive
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                  : "border-line bg-surface text-ink-soft hover:border-brand-300 hover:bg-mist",
              )}
            >
              {c.name}
              {(closed || full) && (
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    isActive ? "text-white/80" : "text-muted",
                  )}
                >
                  {closed ? "Closed" : "Full"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Slot bands */}
      {activeCourt?.slots.length === 0 ? (
        <p className="rounded-xl border border-line bg-canvas px-4 py-5 text-sm text-muted">Closed on this day.</p>
      ) : activeCourt?.slots.every((s) => !s.available) ? (
        <p className="rounded-xl border border-line bg-canvas px-4 py-5 text-sm text-muted">No open times for this date.</p>
      ) : (
        <div className="space-y-6">
          {bands.map((band) => (
            <div key={band.label}>
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted">
                {band.label}
              </p>
              <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
                {band.slots.map((slot) => {
                  const isSel =
                    selected?.courtId === activeId &&
                    selected?.startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={isSel}
                      aria-label={`${activeCourt?.name}, ${timeLabel(new Date(slot.startsAt))}, ${slot.available ? pesos(slot.priceCents) : "unavailable"}`}
                      onClick={() => activeCourt && onSelect(activeCourt, slot)}
                      className={cn(
                        "flex h-12 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                        !slot.available
                          ? "cursor-not-allowed border-transparent bg-mist text-muted/60 line-through"
                          : isSel
                            ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                            : "border-brand-100 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100",
                      )}
                    >
                      {timeLabel(new Date(slot.startsAt))}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
