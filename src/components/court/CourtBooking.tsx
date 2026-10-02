"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Legend } from "@/components/ui/legend";
import { useToast } from "@/components/ui/toast";
import { ScheduleGrid } from "@/components/court/ScheduleGrid";
import { MobileCourtPicker } from "@/components/court/MobileCourtPicker";
import {
  StatefulTabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ArrowRight, Check, X } from "lucide-react";
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
  const [band, setBand] = useState("all");
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
        toast({
          title: "Couldn't reserve that slot",
          description: data.error,
          tone: "error",
        });
        if (res.status === 409) {
          setSelected(null);
          router.refresh();
        }
        return;
      }
      router.push(`/book/${data.reference}`);
    } catch {
      toast({
        title: "Network error",
        description: "Please try again.",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const hours = durationMinutes / 60;
  const durationLabel = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const filteredCourts = courts.map((court) => ({
    ...court,
    slots: court.slots.filter((slot) => {
      const hour = new Date(slot.startsAt).getUTCHours();
      return (
        band === "all" ||
        (band === "morning" && hour < 12) ||
        (band === "afternoon" && hour >= 12 && hour < 17) ||
        (band === "evening" && hour >= 17)
      );
    }),
  }));
  const openCount = filteredCourts.reduce(
    (count, court) =>
      count + court.slots.filter((slot) => slot.available).length,
    0,
  );

  const SLOT_LEGEND = [
    { dotClass: "border border-brand-300 bg-brand-50", label: "Available" },
    { dotClass: "bg-brand-700", label: "Selected" },
    { dotClass: "bg-line", label: "Unavailable" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs text-brand-700">
              3
            </span>{" "}
            Choose a start time
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Prices include all {durationLabel} of court time.
          </p>
        </div>
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
          {openCount} open {openCount === 1 ? "slot" : "slots"}
        </span>
      </div>

      <StatefulTabs value={band} onValueChange={setBand} className="gap-3">
        <TabsList
          aria-label="Filter start times"
          className="h-auto min-h-12 w-full justify-start rounded-full bg-surface p-1 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {[
            { value: "all", label: "All times" },
            { value: "morning", label: "Morning" },
            { value: "afternoon", label: "Afternoon" },
            { value: "evening", label: "Evening" },
          ].map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="min-h-11 rounded-full px-2 text-xs sm:px-3 sm:text-sm data-[state=active]:text-brand-700"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Legend items={SLOT_LEGEND} />
        <TabsContent value={band} className="mt-0">
          {openCount === 0 && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-border bg-surface px-4 py-4 text-sm text-muted-foreground"
            >
              No open slots{" "}
              {band === "all" ? "for this date" : `in the ${band}`}. Try another
              day or a shorter session.
            </div>
          )}

          {/* Desktop: time × court grid */}
          <div className="hidden xl:block">
            <ScheduleGrid
              courts={filteredCourts}
              selected={selected}
              onSelect={select}
            />
          </div>

          {/* Mobile: court chips + banded slots */}
          <div className="xl:hidden">
            <MobileCourtPicker
              courts={filteredCourts}
              selected={selected}
              onSelect={select}
              onCourtChange={() => setSelected(null)}
            />
          </div>
        </TabsContent>
      </StatefulTabs>
      <p className="flex items-center gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <Check className="size-4 shrink-0 text-brand-700" aria-hidden />
        Pay the venue directly. Your reservation is confirmed by the venue.
      </p>

      {selected && (
        <div
          data-booking-summary
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] z-30 mx-auto max-w-4xl rounded-2xl border border-border bg-white/95 p-4 shadow-[0_8px_40px_-12px_rgb(0_30_43/0.24)] backdrop-blur-xl md:inset-x-6 md:bottom-[max(20px,env(safe-area-inset-bottom))]"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 sm:flex sm:gap-4">
            <div
              className="min-w-0 sm:flex-1"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="truncate text-sm font-semibold text-ink sm:text-base">
                {selected.courtName}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {selectedDateLabel} · {timeLabel(new Date(selected.startsAt))} –{" "}
                {timeLabel(
                  new Date(
                    new Date(selected.startsAt).getTime() +
                      durationMinutes * 60_000,
                  ),
                )}
              </p>
            </div>
            <div className="text-right sm:shrink-0">
              <p className="text-[11px] text-muted-foreground">
                Total · {durationLabel}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink sm:text-xl">
                {pesos(selected.priceCents)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Clear selection"
              disabled={submitting}
              onClick={() => setSelected(null)}
              className="col-start-1 row-start-2 justify-self-start gap-1.5 px-2 text-xs text-muted-foreground sm:order-last sm:size-11 sm:p-0"
            >
              <X className="size-4" aria-hidden />
              <span className="sm:hidden">Clear</span>
            </Button>
            <Button
              onClick={reserve}
              loading={submitting}
              size="lg"
              className="col-start-2 row-start-2 shrink-0 gap-2 px-5 sm:px-6"
            >
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
