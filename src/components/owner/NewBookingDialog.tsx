"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
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
  const [courtId, setCourtId] = useState(
    prefill?.courtId ?? courts[0]?.id ?? "",
  );
  const [startMinute, setStartMinute] = useState(
    prefill?.startMinute ?? hours[0] ?? 8 * 60,
  );
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
        toast({
          title: "Couldn't create booking",
          description: data.error,
          tone: "error",
        });
        return;
      }
      toast({ title: "Walk-in booked", tone: "success" });
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
      <DialogContent title="New walk-in booking">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Court" htmlFor="wb-court">
            <SelectField
              id="wb-court"
              value={courtId}
              onValueChange={(value) => setCourtId(value)}
            >
              {courts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="wb-start">
              <SelectField
                id="wb-start"
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
            <Field label="Duration" htmlFor="wb-dur">
              <SelectField
                id="wb-dur"
                value={durationH}
                onValueChange={(value) => setDurationH(Number(value))}
              >
                <SelectItem value={String(1)}>1 hour</SelectItem>
                <SelectItem value={String(2)}>2 hours</SelectItem>
                <SelectItem value={String(3)}>3 hours</SelectItem>
              </SelectField>
            </Field>
          </div>
          <Field label="Customer name" htmlFor="wb-name">
            <Input
              id="wb-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Mobile (optional)" htmlFor="wb-mobile">
            <Input
              id="wb-mobile"
              inputMode="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </Field>
          <Field label="Paid via" htmlFor="wb-pm">
            <SelectField
              id="wb-pm"
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value)}
            >
              {CHANNELS.map((c) => (
                <SelectItem key={c.value} value={String(c.value)}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectField>
          </Field>
          <Field label="Note (optional)" htmlFor="wb-note">
            <Input
              id="wb-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" block loading={busy}>
            Create booking
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
