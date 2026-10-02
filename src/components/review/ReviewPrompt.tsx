"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { useRouter } from "next/navigation";
import { StarRating } from "./StarRating";
import { Stars } from "./Stars";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReviewPrompt({
  bookingId,
  venueName,
  existing,
}: {
  bookingId: string;
  venueName: string;
  existing: { rating: number; body: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(existing === null);
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  const [body, setBody] = React.useState(existing?.body ?? "");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (rating < 1) {
      toast({ title: "Pick a rating first", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body.trim() || null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Something went wrong");
      }
      toast({
        title: existing ? "Review updated" : "Thanks for your review!",
        tone: "success",
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to submit",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (existing && !editing) {
    return (
      <section className="mt-4 rounded-lg border border-black/5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Your review</h2>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setEditing(true)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-brand-700 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Edit
          </Button>
        </div>
        <div className="mt-2">
          <Stars value={existing.rating} />
        </div>
        {existing.body && (
          <p className="mt-1.5 text-sm text-ink-soft">{existing.body}</p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-black/5 p-4">
      <h2 className="text-base font-bold text-ink">How was your experience?</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Rate your visit to {venueName}.
      </p>
      <div className="mt-3">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <Label htmlFor={`review-body-${bookingId}`} className="sr-only">
        Share a little about your visit (optional)
      </Label>
      <Textarea
        id={`review-body-${bookingId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Share a little about your visit (optional)"
        className="form-control mt-4 min-h-32 px-4 py-3 leading-relaxed placeholder:text-muted-foreground/80"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={submit} loading={busy} size="lg">
          {existing ? "Save changes" : "Submit review"}
        </Button>
        {existing && (
          <Button
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
