"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "./api";
import type { VenueStatus } from "@/generated/prisma";

export function ReviewSubmit({
  venueId,
  status,
  missing,
  submittedNote,
  rejectionReason,
}: {
  venueId: string;
  status: VenueStatus;
  missing: string[];
  submittedNote: string | null;
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(submittedNote ?? "");
  const [busy, setBusy] = useState(false);
  const ready = missing.length === 0;

  if (status === "PENDING_REVIEW") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 font-semibold text-amber-900">
          <Clock className="size-5" aria-hidden /> Submitted for review
        </div>
        <p className="mt-1 text-sm text-amber-900">
          We&apos;ll notify you once an admin reviews your venue.
        </p>
        {submittedNote && <p className="mt-3 text-sm text-ink-soft">Your note: “{submittedNote}”</p>}
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <div className="flex items-center gap-2 font-semibold text-brand-800">
          <Check className="size-5" aria-hidden /> Approved!
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Your venue is approved. Preview it, then publish to go live.
        </p>
        <Link href="/owner/venues" className="mt-4 inline-block">
          <Button>Go to My venues</Button>
        </Link>
      </div>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="font-semibold text-red-700">This venue is suspended.</p>
        {rejectionReason && <p className="mt-1 text-sm text-red-700">Reason: {rejectionReason}</p>}
      </div>
    );
  }

  // DRAFT or REJECTED
  async function submit() {
    setBusy(true);
    try {
      await sendJson(`/api/owner/venues/${venueId}/submit`, "POST", { note });
      toast({ title: "Submitted for review", tone: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't submit", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {status === "REJECTED" && rejectionReason && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Changes requested:</strong> {rejectionReason}
        </div>
      )}

      <div className="rounded-2xl border border-black/5 p-4">
        <h2 className="text-sm font-semibold text-ink">Before you submit</h2>
        {ready ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-brand-700">
            <Check className="size-4" aria-hidden /> Everything looks good.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {missing.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm text-ink-soft">
                <CircleAlert className="size-4 text-amber-500" aria-hidden /> {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="note" className="block text-sm font-medium text-ink-soft">
          Note for the reviewer
        </label>
        <textarea
          id="note"
          rows={3}
          className="w-full rounded-xl border border-black/10 bg-white p-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          placeholder="Tell us about your venue and how we can verify it."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button size="lg" block loading={busy} disabled={!ready || !note.trim()} onClick={submit}>
        {ready ? "Submit for verification" : "Complete the steps above first"}
      </Button>
    </div>
  );
}
