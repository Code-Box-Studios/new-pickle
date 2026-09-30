"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Legend } from "@/components/ui/legend";
import { useToast } from "@/components/ui/toast";
import { ScheduleGrid } from "@/components/court/ScheduleGrid";
import { MobileCourtPicker } from "@/components/court/MobileCourtPicker";
import { pesos, timeLabel } from "@/lib/format";

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

  const SLOT_LEGEND = [
    { dotClass: "border border-brand-300 bg-brand-50", label: "Available" },
    { dotClass: "bg-brand-700", label: "Selected" },
    { dotClass: "bg-line", label: "Unavailable" },
  ];

  return (
    <div className="space-y-5">
      <Legend items={SLOT_LEGEND} />

      {/* Desktop: time × court grid */}
      <div className="hidden md:block">
        <ScheduleGrid courts={courts} selected={selected} onSelect={select} />
      </div>

      {/* Mobile: court chips + banded slots */}
      <div className="md:hidden">
        <MobileCourtPicker courts={courts} selected={selected} onSelect={select} />
      </div>

      {selected && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-4 shadow-[0_-8px_32px_-16px_rgba(24,37,31,0.18)] backdrop-blur md:bottom-0 md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:flex sm:gap-5">
            <div className="min-w-0 sm:flex-1" aria-live="polite" aria-atomic="true">
              <p className="truncate text-sm font-semibold text-ink sm:text-base">
                {selected.courtName} · {selectedDateLabel}
              </p>
              <p className="mt-1 text-xs text-muted sm:text-sm">
                {timeLabel(new Date(selected.startsAt))} · {durationLabel}
              </p>
            </div>
            <p className="col-start-1 row-start-2 text-base font-semibold text-ink sm:shrink-0 sm:text-lg">{pesos(selected.priceCents)}</p>
            <Button onClick={reserve} loading={submitting} size="lg" className="col-start-2 row-span-2 row-start-1 shrink-0 px-5 sm:px-6">
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
