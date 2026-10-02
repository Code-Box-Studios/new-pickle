"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { isoAt, hourOptions, minuteLabel } from "./cal-utils";

const TYPES = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "PRIVATE_EVENT", label: "Private event" },
  { value: "CLOSURE", label: "Closure" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "TOURNAMENT", label: "Tournament" },
];

export function BlockDialog({
  open,
  onOpenChange,
  venueId,
  dateIso,
  courts,
  openMinute,
  closeMinute,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venueId: string;
  dateIso: string;
  courts: { id: string; name: string }[];
  openMinute: number;
  closeMinute: number;
  prefill?: { courtId?: string; startMinute?: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const hours = hourOptions(openMinute, closeMinute);
  const endChoices = [...hours.map((m) => m + 60)].filter(
    (m) => m <= closeMinute,
  );
  const [scope, setScope] = useState(prefill?.courtId ?? "all");
  const [startMinute, setStartMinute] = useState(
    prefill?.startMinute ?? hours[0] ?? 8 * 60,
  );
  const [endMinute, setEndMinute] = useState(
    (prefill?.startMinute ?? hours[0] ?? 8 * 60) + 60,
  );
  const [type, setType] = useState("MAINTENANCE");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (endMinute <= startMinute) {
      toast({ title: "End must be after start", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/owner/venues/${venueId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: scope === "all" ? null : scope,
          startsAt: isoAt(dateIso, startMinute),
          endsAt: isoAt(dateIso, endMinute),
          type,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Couldn't block",
          description: data.error,
          tone: "error",
        });
        return;
      }
      toast({ title: "Court blocked", tone: "success" });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast({
        title: "Network error",
        description: "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Block a court">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Court" htmlFor="bk-court">
            <SelectField
              id="bk-court"
              value={scope}
              onValueChange={(value) => setScope(value)}
            >
              <SelectItem value="all">All courts (venue-wide)</SelectItem>
              {courts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="bk-start">
              <SelectField
                id="bk-start"
                value={startMinute}
                onValueChange={(value) => setStartMinute(Number(value))}
              >
                {hours.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {minuteLabel(m)}
                  </SelectItem>
                ))}
              </SelectField>
            </Field>
            <Field label="To" htmlFor="bk-end">
              <SelectField
                id="bk-end"
                value={endMinute}
                onValueChange={(value) => setEndMinute(Number(value))}
              >
                {endChoices.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {minuteLabel(m)}
                  </SelectItem>
                ))}
              </SelectField>
            </Field>
          </div>
          <Field label="Reason" htmlFor="bk-type">
            <SelectField
              id="bk-type"
              value={type}
              onValueChange={(value) => setType(value)}
            >
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={String(t.value)}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field label="Note (optional)" htmlFor="bk-reason">
            <Input
              id="bk-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shown on the calendar"
            />
          </Field>
          <Button type="submit" size="lg" block loading={busy} variant="danger">
            Block court
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
