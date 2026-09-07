"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ConfirmRejectActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);

  async function act(kind: "confirm" | "reject") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/owner/bookings/${bookingId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "reject" ? JSON.stringify({}) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Action failed", description: data.error, tone: "error" });
        return;
      }
      toast({
        title: kind === "confirm" ? "Booking confirmed" : "Booking rejected",
        description:
          kind === "confirm" ? "The customer has been notified." : undefined,
        tone: kind === "confirm" ? "success" : "default",
      });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Please try again.", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-3">
      <Button onClick={() => act("confirm")} loading={busy === "confirm"} disabled={busy !== null}>
        Confirm booking
      </Button>
      <Button
        variant="danger"
        onClick={() => act("reject")}
        loading={busy === "reject"}
        disabled={busy !== null}
      >
        Reject
      </Button>
    </div>
  );
}
