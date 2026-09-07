"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { VenueStatus } from "@/generated/prisma";

export function ReviewActions({ venueId, status }: { venueId: string; status: VenueStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<null | "reject" | "suspend">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(kind: "approve" | "reject" | "suspend" | "reinstate", withReason?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/venues/${venueId}/${kind}`, {
        method: "POST",
        headers: withReason !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: withReason !== undefined ? JSON.stringify({ reason: withReason }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Action failed", description: data.error, tone: "error" });
        return;
      }
      toast({ title: `Venue ${kind}d`, tone: kind === "approve" || kind === "reinstate" ? "success" : "default" });
      setMode(null);
      setReason("");
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (mode) {
    return (
      <div className="space-y-3">
        <textarea
          rows={3}
          autoFocus
          className="w-full rounded-xl border border-black/10 bg-white p-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          placeholder={mode === "reject" ? "What needs to change before approval?" : "Why is this venue being suspended?"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => decide(mode, reason.trim())}>
            Confirm {mode}
          </Button>
          <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (status === "PENDING_REVIEW") {
    return (
      <div className="flex gap-2">
        <Button loading={busy} onClick={() => decide("approve")}>Approve</Button>
        <Button variant="danger" onClick={() => setMode("reject")}>Reject</Button>
      </div>
    );
  }
  if (status === "APPROVED") {
    return <Button variant="danger" onClick={() => setMode("suspend")}>Suspend</Button>;
  }
  if (status === "SUSPENDED") {
    return <Button loading={busy} onClick={() => decide("reinstate")}>Reinstate</Button>;
  }
  return <p className="text-sm text-muted">Waiting for the owner to make changes and resubmit.</p>;
}
