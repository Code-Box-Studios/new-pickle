"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "./api";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Row = { dayOfWeek: number; open: string; close: string; closed: boolean };

function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function HoursEditor({
  venueId,
  initialDays,
  hasActiveCourts,
  locked,
}: {
  venueId: string;
  initialDays: { dayOfWeek: number; openMinute: number; closeMinute: number }[];
  hasActiveCourts: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const byDay = new Map(initialDays.map((d) => [d.dayOfWeek, d]));
  const [rows, setRows] = useState<Row[]>(
    ORDER.map((dow) => {
      const d = byDay.get(dow);
      return d
        ? { dayOfWeek: dow, open: toHHMM(d.openMinute), close: toHHMM(d.closeMinute), closed: false }
        : { dayOfWeek: dow, open: "08:00", close: "22:00", closed: true };
    }),
  );
  const [busy, setBusy] = useState(false);

  function update(dow: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === dow ? { ...r, ...patch } : r)));
  }
  function applyToAll() {
    const first = rows.find((r) => !r.closed) ?? rows[0];
    setRows((prev) => prev.map((r) => ({ ...r, open: first.open, close: first.close, closed: false })));
  }

  async function save() {
    setBusy(true);
    try {
      const days = rows
        .filter((r) => !r.closed && toMinutes(r.open) < toMinutes(r.close))
        .map((r) => ({ dayOfWeek: r.dayOfWeek, openMinute: toMinutes(r.open), closeMinute: toMinutes(r.close) }));
      await sendJson(`/api/owner/venues/${venueId}/hours`, "PUT", { days });
      router.push(`/owner/venues/${venueId}/payments`);
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save hours", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!hasActiveCourts) {
    return (
      <p className="text-sm text-muted">
        Add at least one active court first — hours apply to all of your courts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-muted">These hours apply to all your active courts.</p>
        {!locked && (
          <Button variant="ghost" size="sm" onClick={applyToAll}>
            Apply first day to all
          </Button>
        )}
      </div>

      <fieldset disabled={locked} className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.dayOfWeek} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[7rem_5rem_1fr]">
            <span className="text-sm font-semibold text-ink">{DAY_NAMES[r.dayOfWeek]}</span>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input type="checkbox" aria-label={`${DAY_NAMES[r.dayOfWeek]} open`} className="size-4 accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2" checked={!r.closed} onChange={(e) => update(r.dayOfWeek, { closed: !e.target.checked })} />
              Open
            </label>
            {!r.closed && (
              <div className="col-span-2 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:col-span-1">
                <input type="time" aria-label={`${DAY_NAMES[r.dayOfWeek]} opening time`} value={r.open} onChange={(e) => update(r.dayOfWeek, { open: e.target.value })} className="h-11 min-w-0 w-full rounded-xl border border-line bg-canvas px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
                <span className="text-muted">–</span>
                <input type="time" aria-label={`${DAY_NAMES[r.dayOfWeek]} closing time`} value={r.close} onChange={(e) => update(r.dayOfWeek, { close: e.target.value })} className="h-11 min-w-0 w-full rounded-xl border border-line bg-canvas px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
              </div>
            )}
          </div>
        ))}
      </fieldset>

      {!locked && (
        <Button size="lg" block loading={busy} onClick={save}>
          Save &amp; continue
        </Button>
      )}
    </div>
  );
}
