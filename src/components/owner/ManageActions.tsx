"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { BookingStatus } from "@/generated/prisma";

const OCCUPYING: BookingStatus[] = [
  "HELD",
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
];

export function ManageActions({
  bookingId,
  status,
  startsAtIso,
  durationMinutes,
}: {
  bookingId: string;
  status: BookingStatus;
  startsAtIso: string;
  durationMinutes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const start = new Date(startsAtIso);
  const [date, setDate] = useState(startsAtIso.slice(0, 10));
  const [time, setTime] = useState(
    `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`,
  );
  const [durH, setDurH] = useState(
    Math.max(1, Math.round(durationMinutes / 60)),
  );
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = OCCUPYING.includes(status);
  if (!canManage) return null;

  async function act(kind: "cancel" | "complete") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/owner/bookings/${bookingId}/${kind}`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        return toast({
          title: "Action failed",
          description: d.error,
          tone: "error",
        });
      toast({
        title: kind === "cancel" ? "Booking cancelled" : "Marked completed",
        tone: "default",
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function submitReschedule() {
    setBusy("reschedule");
    try {
      const res = await fetch(`/api/owner/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: `${date}T${time}:00.000Z`,
          durationMinutes: durH * 60,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok)
        return toast({
          title: "Couldn't reschedule",
          description: d.error,
          tone: "error",
        });
      toast({ title: "Booking rescheduled", tone: "success" });
      setRescheduling(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {rescheduling ? (
        <Card className="space-y-4 rounded-lg border border-brand-200 bg-mist p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="rs-date">
              <DatePicker
                id="rs-date"
                value={date}
                onValueChange={setDate}
                className="min-w-0 px-3"
              />
            </Field>
            <Field label="Start" htmlFor="rs-time">
              <Input
                id="rs-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-w-0 px-3"
              />
            </Field>
          </div>
          <Field label="Duration" htmlFor="rs-dur">
            <SelectField
              id="rs-dur"
              value={durH}
              onValueChange={(value) => setDurH(Number(value))}
            >
              <SelectItem value={String(1)}>1 hour</SelectItem>
              <SelectItem value={String(2)}>2 hours</SelectItem>
              <SelectItem value={String(3)}>3 hours</SelectItem>
            </SelectField>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button loading={busy === "reschedule"} onClick={submitReschedule}>
              Save new time
            </Button>
            <Button variant="ghost" onClick={() => setRescheduling(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRescheduling(true)}>
            Reschedule
          </Button>
          {status === "CONFIRMED" && (
            <Button
              variant="secondary"
              loading={busy === "complete"}
              onClick={() => act("complete")}
            >
              Mark completed
            </Button>
          )}
          <Button
            variant="danger"
            loading={busy === "cancel"}
            onClick={() => act("cancel")}
          >
            Cancel booking
          </Button>
        </div>
      )}
    </div>
  );
}
