"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { minuteLabel } from "./cal-utils";
import { NewBookingDialog } from "./NewBookingDialog";
import { BlockDialog } from "./BlockDialog";
import type { CellState, DayCourt } from "@/lib/venue/ops";

const META: Record<CellState, { label: string; cls: string; swatch: string }> = {
  AVAILABLE: { label: "Open", cls: "bg-white text-brand-700 border border-dashed border-brand-300 hover:bg-brand-50", swatch: "bg-white border border-brand-300" },
  HELD: { label: "Held", cls: "bg-amber-100 text-amber-900", swatch: "bg-amber-300" },
  PENDING: { label: "Pending", cls: "bg-sky-100 text-sky-900", swatch: "bg-sky-300" },
  CONFIRMED: { label: "Confirmed", cls: "bg-brand-100 text-brand-900", swatch: "bg-brand-500" },
  BLOCKED: { label: "Blocked", cls: "bg-slate-200 text-slate-700", swatch: "bg-slate-400" },
  CLOSED: { label: "Closed", cls: "bg-slate-50 text-slate-300", swatch: "bg-slate-200" },
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
  const template = `4.5rem repeat(${courts.length}, minmax(7rem, 1fr))`;

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
    <div className="space-y-4">
      {/* Legend — color + label (never color alone) */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className={cn("size-3 rounded", META[s].swatch)} aria-hidden />
            {META[s].label}
          </span>
        ))}
      </div>

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
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-fit gap-1" style={{ gridTemplateColumns: template }}>
            <div />
            {courts.map((c) => (
              <div key={c.id} className="px-1 pb-1 text-center text-xs font-semibold text-ink">
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
                  const base = "flex min-h-14 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center text-[11px] font-medium leading-tight";
                  if (cell.state === "AVAILABLE") {
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openNew({ courtId: c.id, startMinute: cell.startMinute })}
                        className={cn(base, meta.cls)}
                      >
                        {meta.label}
                      </button>
                    );
                  }
                  if (cell.reference) {
                    return (
                      <Link key={c.id} href={`/owner/reservations/${cell.reference}`} className={cn(base, meta.cls)}>
                        <span>{meta.label}</span>
                        {cell.label && <span className="mt-0.5 truncate text-[10px] opacity-80">{cell.label}</span>}
                      </Link>
                    );
                  }
                  if (cell.state === "BLOCKED") {
                    return (
                      <div key={c.id} className={cn(base, meta.cls, "relative")}>
                        <span>{meta.label}</span>
                        {cell.label && <span className="mt-0.5 truncate text-[10px] opacity-80">{cell.label}</span>}
                        {cell.blockId && (
                          <button
                            type="button"
                            onClick={() => removeBlock(cell.blockId!)}
                            disabled={busyBlock === cell.blockId}
                            className="absolute right-0.5 top-0.5 rounded p-0.5 text-slate-500 hover:bg-black/10"
                            aria-label="Remove block"
                          >
                            <X className="size-3" />
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
      <div className="fixed inset-x-0 bottom-14 z-30 flex gap-2 border-t border-black/5 bg-white/95 p-3 backdrop-blur sm:hidden">
        <Button block onClick={() => openNew({})}><Plus className="size-4" /> New booking</Button>
        <Button block variant="outline" onClick={() => setMode("block")}><Ban className="size-4" /> Block</Button>
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
