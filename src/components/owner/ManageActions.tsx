"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { BookingStatus } from "@/generated/prisma";

const OCCUPYING: BookingStatus[] = ["HELD", "PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED"];

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
  const [durH, setDurH] = useState(Math.max(1, Math.round(durationMinutes / 60)));
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = OCCUPYING.includes(status);
  if (!canManage) return null;

  async function act(kind: "cancel" | "complete") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/owner/bookings/${bookingId}/${kind}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast({ title: "Action failed", description: d.error, tone: "error" });
      toast({ title: kind === "cancel" ? "Booking cancelled" : "Marked completed", tone: "default" });
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
        body: JSON.stringify({ startsAt: `${date}T${time}:00.000Z`, durationMinutes: durH * 60 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast({ title: "Couldn't reschedule", description: d.error, tone: "error" });
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
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="rs-date">
              <input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-xl border border-black/10 px-3 text-[15px]" />
            </Field>
            <Field label="Start" htmlFor="rs-time">
              <input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 w-full rounded-xl border border-black/10 px-3 text-[15px]" />
            </Field>
          </div>
          <Field label="Duration" htmlFor="rs-dur">
            <Select id="rs-dur" value={durH} onChange={(e) => setDurH(Number(e.target.value))}>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button loading={busy === "reschedule"} onClick={submitReschedule}>Save new time</Button>
            <Button variant="ghost" onClick={() => setRescheduling(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRescheduling(true)}>Reschedule</Button>
          {status === "CONFIRMED" && (
            <Button variant="secondary" loading={busy === "complete"} onClick={() => act("complete")}>
              Mark completed
            </Button>
          )}
          <Button variant="danger" loading={busy === "cancel"} onClick={() => act("cancel")}>
            Cancel booking
          </Button>
        </div>
      )}
    </div>
  );
}
