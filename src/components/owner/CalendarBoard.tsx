"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Legend } from "@/components/ui/legend";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { minuteLabel } from "./cal-utils";
import { NewBookingDialog } from "./NewBookingDialog";
import { BlockDialog } from "./BlockDialog";
import type { CellState, DayCourt } from "@/lib/venue/ops";

const META: Record<CellState, { label: string; cls: string; swatch: string }> = {
  AVAILABLE: { label: "Open", cls: "bg-surface text-brand-700 border border-dashed border-brand-300 hover:bg-mist", swatch: "bg-white border border-brand-300" },
  HELD: { label: "Held", cls: "bg-amber-100 text-amber-900", swatch: "bg-amber-300" },
  PENDING: { label: "Pending", cls: "bg-sky-100 text-sky-900", swatch: "bg-sky-300" },
  CONFIRMED: { label: "Confirmed", cls: "bg-brand-100 text-brand-900", swatch: "bg-brand-500" },
  BLOCKED: { label: "Blocked", cls: "bg-line text-ink-soft", swatch: "bg-slate-400" },
  CLOSED: { label: "Closed", cls: "bg-canvas text-muted/70", swatch: "bg-slate-200" },
};
const LEGEND: CellState[] = ["AVAILABLE", "HELD", "PENDING", "CONFIRMED", "BLOCKED", "CLOSED"];

type Prefill = { courtId?: string; startMinute?: number };

export function CalendarBoard({
  venueId,
  dateIso,
  openMinute,
  closeMinute,
  courts,
  autoOpen,
}: {
  venueId: string;
  dateIso: string;
  openMinute: number;
  closeMinute: number;
  courts: DayCourt[];
  autoOpen?: "new" | "block";
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<null | "new" | "block">(autoOpen ?? null);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [busyBlock, setBusyBlock] = useState<string | null>(null);

  const courtRefs = courts.map((c) => ({ id: c.id, name: c.name }));
  const rows = courts[0]?.cells.length ?? 0;
  const template = `4.5rem repeat(${courts.length}, minmax(8rem, 1fr))`;

  function openNew(p: Prefill) {
    setPrefill(p);
    setMode("new");
  }

  async function removeBlock(blockId: string) {
    setBusyBlock(blockId);
    try {
      const res = await fetch(`/api/owner/venues/${venueId}/blocks/${blockId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Couldn't remove block", description: d.error, tone: "error" });
        return;
      }
      router.refresh();
    } finally {
      setBusyBlock(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Legend — color + label (never color alone) */}
      <Legend items={LEGEND.map((state) => ({ dotClass: META[state].swatch, label: state === "AVAILABLE" ? "Available" : META[state].label }))} />

      {/* Actions (desktop) */}
      <div className="hidden gap-2 sm:flex">
        <Button onClick={() => openNew({})}><Plus className="size-4" /> New booking</Button>
        <Button variant="outline" onClick={() => setMode("block")}><Ban className="size-4" /> Block court</Button>
      </div>

      {courts.length === 0 || rows === 0 ? (
        <p className="rounded-xl border border-black/5 bg-white p-6 text-center text-muted">
          No operating hours set for this day.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4">
          <div className="grid min-w-fit gap-1.5" style={{ gridTemplateColumns: template }}>
            <div />
            {courts.map((c) => (
              <div key={c.id} className="px-2 pb-3 pt-1 text-center text-sm font-semibold text-ink">
                {c.name}
              </div>
            ))}
            {Array.from({ length: rows }).map((_, r) => (
              <Row key={r}>
                <div className="flex items-center justify-end pr-2 text-xs text-muted">
                  {minuteLabel(courts[0].cells[r].startMinute)}
                </div>
                {courts.map((c) => {
                  const cell = c.cells[r];
                  const meta = META[cell.state];
                  const base = "flex min-h-18 min-w-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-xs font-medium leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1";
                  if (cell.state === "AVAILABLE") {
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-label={`Book ${c.name} at ${minuteLabel(cell.startMinute)}`}
                        onClick={() => openNew({ courtId: c.id, startMinute: cell.startMinute })}
                        className={cn(base, meta.cls)}
                      >
                        {meta.label}
                      </button>
                    );
                  }
                  if (cell.reference) {
                    return (
                      <Link key={c.id} href={`/owner/reservations/${cell.reference}`} aria-label={`${meta.label}: ${c.name} at ${minuteLabel(cell.startMinute)}${cell.label ? `, ${cell.label}` : ""}`} className={cn(base, meta.cls)}>
                        <span>{meta.label}</span>
                        {cell.label && <span className="mt-1 max-w-full truncate text-[11px] opacity-80">{cell.label}</span>}
                      </Link>
                    );
                  }
                  if (cell.state === "BLOCKED") {
                    return (
                      <div key={c.id} className={cn(base, meta.cls, "relative pr-11")}>
                        <span>{meta.label}</span>
                        {cell.label && <span className="mt-0.5 truncate text-[10px] opacity-80">{cell.label}</span>}
                        {cell.blockId && (
                          <button
                            type="button"
                            onClick={() => removeBlock(cell.blockId!)}
                            disabled={busyBlock === cell.blockId}
                            className="absolute right-0 top-0 grid size-11 place-items-center rounded-xl text-muted hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
                            aria-label={`Remove block from ${c.name} at ${minuteLabel(cell.startMinute)}`}
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={c.id} className={cn(base, meta.cls)}>
                      {meta.label}
                    </div>
                  );
                })}
              </Row>
            ))}
          </div>
        </div>
      )}

      {/* Sticky mobile actions */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-2 gap-3 border-t border-line bg-surface/95 p-3 backdrop-blur-lg sm:hidden">
        <Button block className="min-w-0 px-3" onClick={() => openNew({})}><Plus className="size-4" /> New booking</Button>
        <Button block className="min-w-0 px-3" variant="outline" onClick={() => setMode("block")}><Ban className="size-4" /> Block</Button>
      </div>

      <NewBookingDialog
        open={mode === "new"}
        onOpenChange={(o) => setMode(o ? "new" : null)}
        venueId={venueId}
        dateIso={dateIso}
        courts={courtRefs}
        openMinute={openMinute}
        closeMinute={closeMinute}
        prefill={prefill}
      />
      <BlockDialog
        open={mode === "block"}
        onOpenChange={(o) => setMode(o ? "block" : null)}
        venueId={venueId}
        dateIso={dateIso}
        courts={courtRefs}
        openMinute={openMinute}
        closeMinute={closeMinute}
      />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
