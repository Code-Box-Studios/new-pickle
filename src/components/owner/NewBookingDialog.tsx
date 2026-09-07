"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { isoAt, hourOptions, minuteLabel } from "./cal-utils";

const CHANNELS = [
  { value: "Cash", label: "Cash" },
  { value: "GCash", label: "GCash" },
  { value: "Maya", label: "Maya" },
  { value: "Bank transfer", label: "Bank transfer" },
];

export function NewBookingDialog({
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
  const [courtId, setCourtId] = useState(prefill?.courtId ?? courts[0]?.id ?? "");
  const [startMinute, setStartMinute] = useState(prefill?.startMinute ?? hours[0] ?? 8 * 60);
  const [durationH, setDurationH] = useState(1);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/owner/venues/${venueId}/walkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          startsAt: isoAt(dateIso, startMinute),
          durationMinutes: durationH * 60,
          name,
          mobile,
          paymentMethod,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't create booking", description: data.error, tone: "error" });
        return;
      }
      toast({ title: "Walk-in booked", tone: "success" });
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
      <DialogContent title="New walk-in booking">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Court" htmlFor="wb-court">
            <Select id="wb-court" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="wb-start">
              <Select id="wb-start" value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))}>
                {hours.map((m) => (
                  <option key={m} value={m}>{minuteLabel(m)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Duration" htmlFor="wb-dur">
              <Select id="wb-dur" value={durationH} onChange={(e) => setDurationH(Number(e.target.value))}>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
              </Select>
            </Field>
          </div>
          <Field label="Customer name" htmlFor="wb-name">
            <Input id="wb-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mobile (optional)" htmlFor="wb-mobile">
            <Input id="wb-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
          <Field label="Paid via" htmlFor="wb-pm">
            <Select id="wb-pm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)" htmlFor="wb-note">
            <Input id="wb-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" block loading={busy}>Create booking</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
