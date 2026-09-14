"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { timeLabel } from "@/lib/format";
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
    <div className="space-y-4">
      {/* Court selector chips */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {courts.map((c) => {
          const closed = c.slots.length === 0;
          const full = !closed && c.slots.every((s) => !s.available);
          const isActive = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-black/10 bg-white text-ink-soft hover:bg-black/5",
              )}
            >
              {c.name}
              {(closed || full) && (
                <span
                  className={cn(
                    "ml-1.5 text-[10px]",
                    isActive ? "text-white/70" : "text-muted",
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
        <p className="text-sm text-muted">Closed on this day.</p>
      ) : activeCourt?.slots.every((s) => !s.available) ? (
        <p className="text-sm text-muted">No open times for this date.</p>
      ) : (
        <div className="space-y-4">
          {bands.map((band) => (
            <div key={band.label}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
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
                      onClick={() => activeCourt && onSelect(activeCourt, slot)}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl text-[13px] font-medium tabular-nums transition",
                        !slot.available
                          ? "cursor-not-allowed bg-slate-100 text-slate-300 line-through"
                          : isSel
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-brand-50 text-brand-800 hover:bg-brand-100",
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
