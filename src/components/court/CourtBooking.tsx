"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { pesos, timeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface SlotDTO {
  startsAt: string;
  available: boolean;
  priceCents: number;
}
export interface CourtDTO {
  id: string;
  name: string;
  indoor: boolean;
  covered: boolean;
  surface: string | null;
  priceCents: number;
  slots: SlotDTO[];
}

type Selection = {
  courtId: string;
  courtName: string;
  startsAt: string;
  priceCents: number;
};

export function CourtBooking({
  courts,
  durationMinutes,
  isAuthed,
  returnTo,
  selectedDateLabel,
}: {
  courts: CourtDTO[];
  durationMinutes: number;
  isAuthed: boolean;
  returnTo: string;
  /** Presentational only, e.g. "Tue, Sep 8" — shown in the sticky summary. */
  selectedDateLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idemKey = useRef("");

  function select(court: CourtDTO, slot: SlotDTO) {
    idemKey.current = crypto.randomUUID();
    setSelected({
      courtId: court.id,
      courtName: court.name,
      startsAt: slot.startsAt,
      priceCents: slot.priceCents,
    });
  }

  async function reserve() {
    if (!selected) return;
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey.current,
        },
        body: JSON.stringify({
          courtId: selected.courtId,
          startsAt: selected.startsAt,
          durationMinutes,
        }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't reserve that slot", description: data.error, tone: "error" });
        if (res.status === 409) {
          setSelected(null);
          router.refresh();
        }
        return;
      }
      router.push(`/book/${data.reference}`);
    } catch {
      toast({ title: "Network error", description: "Please try again.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const hours = durationMinutes / 60;
  const durationLabel = `${hours} ${hours === 1 ? "hour" : "hours"}`;

  return (
    <div className="space-y-3">
      {courts.map((court) => {
        const openCount = court.slots.filter((s) => s.available).length;
        const closed = court.slots.length === 0;
        const fullyBooked = !closed && openCount === 0;
        return (
          <div
            key={court.id}
            className="rounded-2xl border border-black/5 p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{court.name}</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {court.indoor ? "Indoor" : "Outdoor"}
                  {court.covered ? " · Covered" : ""}
                  {court.surface ? ` · ${court.surface}` : ""} · {pesos(court.priceCents)}/hour
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  closed
                    ? "bg-slate-100 text-slate-500"
                    : fullyBooked
                      ? "bg-amber-50 text-amber-700"
                      : "bg-brand-50 text-brand-700",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    closed ? "bg-slate-400" : fullyBooked ? "bg-amber-500" : "bg-brand-500",
                  )}
                  aria-hidden
                />
                {closed ? "Closed" : fullyBooked ? "Fully booked" : "Available"}
              </span>
            </div>
            {closed ? (
              <p className="mt-3 text-sm text-muted">Closed on this day.</p>
            ) : fullyBooked ? (
              <p className="mt-3 text-sm text-muted">No open times for this date.</p>
            ) : (
              <>
                <p className="mt-3 mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                  Available times
                </p>
                <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
                  {court.slots.map((slot) => {
                    const isSel =
                      selected?.courtId === court.id && selected?.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={isSel}
                        onClick={() => select(court, slot)}
                        className={cn(
                          "flex h-11 min-w-0 items-center justify-center rounded-xl px-1 text-[13px] font-medium tabular-nums transition",
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
              </>
            )}
          </div>
        );
      })}

      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-black/5 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {selected.courtName} · {selectedDateLabel}
              </p>
              <p className="truncate text-xs text-muted">
                {timeLabel(new Date(selected.startsAt))} · {durationLabel}
              </p>
            </div>
            <p className="shrink-0 text-base font-bold text-ink">{pesos(selected.priceCents)}</p>
            <Button onClick={reserve} loading={submitting} size="lg" className="shrink-0">
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
