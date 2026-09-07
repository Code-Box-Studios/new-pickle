"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  const endChoices = [...hours.map((m) => m + 60)].filter((m) => m <= closeMinute);
  const [scope, setScope] = useState(prefill?.courtId ?? "all");
  const [startMinute, setStartMinute] = useState(prefill?.startMinute ?? hours[0] ?? 8 * 60);
  const [endMinute, setEndMinute] = useState((prefill?.startMinute ?? hours[0] ?? 8 * 60) + 60);
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
        toast({ title: "Couldn't block", description: data.error, tone: "error" });
        return;
      }
      toast({ title: "Court blocked", tone: "success" });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Block a court">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Court" htmlFor="bk-court">
            <Select id="bk-court" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All courts (venue-wide)</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="bk-start">
              <Select id="bk-start" value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))}>
                {hours.map((m) => (
                  <option key={m} value={m}>{minuteLabel(m)}</option>
                ))}
              </Select>
            </Field>
            <Field label="To" htmlFor="bk-end">
              <Select id="bk-end" value={endMinute} onChange={(e) => setEndMinute(Number(e.target.value))}>
                {endChoices.map((m) => (
                  <option key={m} value={m}>{minuteLabel(m)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Reason" htmlFor="bk-type">
            <Select id="bk-type" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)" htmlFor="bk-reason">
            <Input id="bk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown on the calendar" />
          </Field>
          <Button type="submit" size="lg" block loading={busy} variant="danger">Block court</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
