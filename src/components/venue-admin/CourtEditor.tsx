"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { pesos } from "@/lib/format";
import { sendJson } from "./api";

export interface CourtDTO {
  id: string;
  name: string;
  indoor: boolean;
  covered: boolean;
  surface: string | null;
  capacity: number;
  priceCents: number;
  active: boolean;
}

type Draft = {
  name: string;
  indoor: boolean;
  covered: boolean;
  surface: string;
  capacity: number;
  pricePeso: number;
  active: boolean;
};

const EMPTY: Draft = { name: "", indoor: true, covered: false, surface: "", capacity: 4, pricePeso: 400, active: true };

function toDraft(c: CourtDTO): Draft {
  return {
    name: c.name,
    indoor: c.indoor,
    covered: c.covered,
    surface: c.surface ?? "",
    capacity: c.capacity,
    pricePeso: Math.round(c.priceCents / 100),
    active: c.active,
  };
}
function toPayload(d: Draft) {
  return {
    name: d.name,
    indoor: d.indoor,
    covered: d.covered,
    surface: d.surface || null,
    capacity: Number(d.capacity) || 4,
    priceCents: Math.round(Number(d.pricePeso) * 100),
    active: d.active,
  };
}

function CourtFields({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Court name" htmlFor="cname">
        <Input id="cname" value={value.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Price / hour (₱)" htmlFor="cprice">
        <Input id="cprice" type="number" min={0} value={value.pricePeso} onChange={(e) => set("pricePeso", Number(e.target.value))} />
      </Field>
      <Field label="Type" htmlFor="ctype">
        <Select id="ctype" value={value.indoor ? "indoor" : "outdoor"} onChange={(e) => set("indoor", e.target.value === "indoor")}>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
        </Select>
      </Field>
      <Field label="Surface" htmlFor="csurf">
        <Input id="csurf" value={value.surface} onChange={(e) => set("surface", e.target.value)} placeholder="e.g. Acrylic" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="accent-brand-600" checked={value.covered} onChange={(e) => set("covered", e.target.checked)} />
        Covered
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="accent-brand-600" checked={value.active} onChange={(e) => set("active", e.target.checked)} />
        Active
      </label>
    </div>
  );
}

export function CourtEditor({
  venueId,
  courts,
  locked,
}: {
  venueId: string;
  courts: CourtDTO[];
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setAdding(null);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save court", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {courts.map((c) => (
          <li key={c.id} className="rounded-xl border border-black/5 p-3">
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <CourtFields value={editing.draft} onChange={(draft) => setEditing({ id: c.id, draft })} />
                <div className="flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => run(() => sendJson(`/api/owner/venues/${venueId}/courts/${c.id}`, "PATCH", toPayload(editing.draft)))}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {c.name} {!c.active && <span className="text-xs text-muted">(inactive)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {c.indoor ? "Indoor" : "Outdoor"}
                    {c.covered ? " · Covered" : ""} · {pesos(c.priceCents)}/hr
                  </p>
                </div>
                {!locked && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditing({ id: c.id, draft: toDraft(c) })} className="rounded-md p-2 text-muted hover:bg-black/5" aria-label="Edit court">
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" onClick={() => run(() => sendJson(`/api/owner/venues/${venueId}/courts/${c.id}`, "DELETE"))} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Delete court">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {courts.length === 0 && <li className="text-sm text-muted">No courts yet — add your first below.</li>}
      </ul>

      {!locked &&
        (adding ? (
          <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <CourtFields value={adding} onChange={setAdding} />
            <div className="flex gap-2">
              <Button size="sm" loading={busy} onClick={() => run(() => sendJson(`/api/owner/venues/${venueId}/courts`, "POST", toPayload(adding)))}>
                Add court
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding({ ...EMPTY })}>
            <Plus className="size-4" /> Add court
          </Button>
        ))}

      {!locked && (
        <Button size="lg" block onClick={() => { router.push(`/owner/venues/${venueId}/hours`); router.refresh(); }}>
          Continue
        </Button>
      )}
    </div>
  );
}
