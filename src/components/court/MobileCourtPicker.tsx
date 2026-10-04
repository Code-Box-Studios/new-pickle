"use client";

import { Button } from "@/components/ui/button";
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
  const midnight: SlotDTO[] = [];
  const morning: SlotDTO[] = [];
  const afternoon: SlotDTO[] = [];
  const evening: SlotDTO[] = [];
  for (const s of slots) {
    const hour = new Date(s.startsAt).getUTCHours();
    if (hour < 6) midnight.push(s);
    else if (hour < 12) morning.push(s);
    else if (hour < 17) afternoon.push(s);
    else evening.push(s);
  }
  return [
    { label: "Midnight", slots: midnight },
    { label: "Morning", slots: morning },
    { label: "Afternoon", slots: afternoon },
    { label: "Evening", slots: evening },
  ].filter((b) => b.slots.length > 0);
}

export function MobileCourtPicker({
  courts,
  selected,
  onSelect,
  onCourtChange,
}: {
  courts: CourtDTO[];
  selected: Selection;
  onSelect: (court: CourtDTO, slot: SlotDTO) => void;
  onCourtChange?: () => void;
}) {
  const defaultCourt =
    courts.find((c) => c.slots.some((s) => s.available)) ?? courts[0];
  const [activeId, setActiveId] = useState<string>(defaultCourt?.id ?? "");

  const activeCourt = courts.find((c) => c.id === activeId) ?? courts[0];
  const bands = activeCourt ? toBands(activeCourt.slots) : [];

  return (
    <div className="space-y-5">
      {/* Court selector chips */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Choose a court"
      >
        {courts.map((c) => {
          const closed = c.slots.length === 0;
          const full = !closed && c.slots.every((s) => !s.available);
          const isActive = c.id === activeId;
          return (
            <Button
              variant="ghost"
              key={c.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                if (c.id !== activeId) onCourtChange?.();
                setActiveId(c.id);
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                isActive
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm hover:bg-brand-700"
                  : "border-line bg-surface text-ink-soft hover:border-brand-300 hover:bg-mist",
              )}
            >
              {c.name}
              {(closed || full) && (
                <span
                  className={cn(
                    "ml-2 text-xs font-normal",
                    isActive ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {closed ? "No times" : "Full"}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {activeCourt && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-3 text-xs text-muted-foreground">
          <span>
            {activeCourt.indoor ? "Indoor" : "Outdoor"}
            {activeCourt.covered ? " · Covered" : ""}
          </span>
          <span className="font-medium text-brand-700">
            {activeCourt.hasVariableRates ? "From " : ""}
            {pesos(activeCourt.priceCents)} / hour
          </span>
        </div>
      )}

      {/* Slot bands */}
      {activeCourt?.slots.length === 0 ? (
        <p className="rounded-xl border border-line bg-canvas px-4 py-5 text-sm text-muted-foreground">
          No start times in this period. Try another day or time of day.
        </p>
      ) : activeCourt?.slots.every((s) => !s.available) ? (
        <p className="rounded-xl border border-line bg-canvas px-4 py-5 text-sm text-muted-foreground">
          No open times for this date.
        </p>
      ) : (
        <div className="space-y-6">
          {bands.map((band) => (
            <div key={band.label}>
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">
                {band.label}
              </p>
              <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-4">
                {band.slots.map((slot) => {
                  const isSel =
                    selected?.courtId === activeId &&
                    selected?.startsAt === slot.startsAt;
                  return (
                    <Button
                      variant="ghost"
                      key={slot.startsAt}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={isSel}
                      aria-label={`${activeCourt?.name}, ${timeLabel(new Date(slot.startsAt))}, ${slot.available ? pesos(slot.priceCents) : "unavailable"}`}
                      onClick={() => activeCourt && onSelect(activeCourt, slot)}
                      className={cn(
                        "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                        !slot.available
                          ? "cursor-not-allowed border-transparent bg-mist text-muted-foreground/60"
                          : isSel
                            ? "border-brand-700 bg-brand-700 text-white shadow-sm hover:bg-brand-700"
                            : "border-brand-200/60 bg-brand-50/60 text-brand-800 hover:border-brand-700/40 hover:bg-secondary",
                      )}
                    >
                      {timeLabel(new Date(slot.startsAt))}
                      <span
                        className={cn(
                          "text-[11px] font-normal",
                          isSel ? "text-white/80" : "text-muted-foreground",
                        )}
                      >
                        {slot.available ? pesos(slot.priceCents) : "Booked"}
                      </span>
                    </Button>
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
