"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { pesos } from "@/lib/format";
import { sendJson } from "./api";
import { PaddleIcon } from "@/components/ui/pickleball";
import { SetupActions } from "./SetupActions";

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

const EMPTY: Draft = {
  name: "",
  indoor: true,
  covered: false,
  surface: "",
  capacity: 4,
  pricePeso: 400,
  active: true,
};

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

function CourtFields({
  value,
  onChange,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
}) {
  const fieldId = useId();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Court name" htmlFor={`${fieldId}-name`}>
        <Input
          id={`${fieldId}-name`}
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="Price / hour (₱)" htmlFor={`${fieldId}-price`}>
        <Input
          id={`${fieldId}-price`}
          type="number"
          min={0}
          value={value.pricePeso}
          onChange={(e) => set("pricePeso", Number(e.target.value))}
        />
      </Field>
      <Field label="Type" htmlFor={`${fieldId}-type`}>
        <SelectField
          id={`${fieldId}-type`}
          value={value.indoor ? "indoor" : "outdoor"}
          onValueChange={(value) => set("indoor", value === "indoor")}
        >
          <SelectItem value="indoor">Indoor</SelectItem>
          <SelectItem value="outdoor">Outdoor</SelectItem>
        </SelectField>
      </Field>
      <Field label="Surface" htmlFor={`${fieldId}-surface`}>
        <Input
          id={`${fieldId}-surface`}
          value={value.surface}
          onChange={(e) => set("surface", e.target.value)}
          placeholder="e.g. Acrylic"
        />
      </Field>
      <Label className="flex min-h-11 items-center gap-2 rounded-lg text-sm text-ink-soft">
        <Checkbox
          checked={value.covered}
          onCheckedChange={(checked) => set("covered", checked === true)}
        />
        Covered
      </Label>
      <Label className="flex min-h-11 items-center gap-2 rounded-lg text-sm text-ink-soft">
        <Checkbox
          checked={value.active}
          onCheckedChange={(checked) => set("active", checked === true)}
        />
        Active
      </Label>
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
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setAdding(null);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't save court",
        description: (err as Error).message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-ink">Your courts</p>
        <span className="text-muted-foreground">
          {courts.filter((court) => court.active).length} active · Rates are per
          hour
        </span>
      </div>
      <ul className="space-y-2">
        {courts.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-line bg-canvas/60 p-4 sm:p-5"
          >
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <CourtFields
                  value={editing.draft}
                  onChange={(draft) => setEditing({ id: c.id, draft })}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={() =>
                      run(() =>
                        sendJson(
                          `/api/owner/venues/${venueId}/courts/${c.id}`,
                          "PATCH",
                          toPayload(editing.draft),
                        ),
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-ink">
                    {c.name}{" "}
                    {!c.active && (
                      <span className="text-xs text-muted-foreground">
                        (inactive)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.indoor ? "Indoor" : "Outdoor"}
                    {c.covered ? " · Covered" : ""} · {pesos(c.priceCents)}/hr
                  </p>
                </div>
                {!locked && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        setEditing({ id: c.id, draft: toDraft(c) })
                      }
                      className="grid size-11 shrink-0 place-items-center p-0 text-muted-foreground hover:bg-mist"
                      aria-label="Edit court"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        run(() =>
                          sendJson(
                            `/api/owner/venues/${venueId}/courts/${c.id}`,
                            "DELETE",
                          ),
                        )
                      }
                      className="grid size-11 shrink-0 place-items-center p-0 text-red-600 hover:bg-red-50"
                      aria-label="Delete court"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {courts.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-mist/30 px-5 py-9 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-white text-brand-700">
              <PaddleIcon className="size-7" />
            </span>
            <p className="text-lg font-medium text-ink">
              Every great venue starts with a court.
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Add a name, court type, and hourly price. Players will choose from
              these when booking.
            </p>
          </li>
        )}
      </ul>

      {!locked &&
        (adding ? (
          <Card className="space-y-5 border-brand-200 bg-mist/30 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <Plus className="size-4 text-brand-700" aria-hidden /> Add a court
            </h3>
            <CourtFields value={adding} onChange={setAdding} />
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy}
                onClick={() =>
                  run(() =>
                    sendJson(
                      `/api/owner/venues/${venueId}/courts`,
                      "POST",
                      toPayload(adding),
                    ),
                  )
                }
              >
                Add court
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="outline" onClick={() => setAdding({ ...EMPTY })}>
            <Plus className="size-4" /> Add court
          </Button>
        ))}

      {!locked && (
        <SetupActions
          venueId={venueId}
          back="photos"
          label="Continue to hours"
          disabled={busy}
          onContinue={() => {
            router.push(`/owner/venues/${venueId}/hours`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
