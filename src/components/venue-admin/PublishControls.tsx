"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function PublishControls({
  venueId,
  isPublished,
}: {
  venueId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function act(kind: "publish" | "unpublish") {
    setBusy(true);
    try {
      const res = await fetch(`/api/owner/venues/${venueId}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't update", description: data.error, tone: "error" });
        return;
      }
      toast({
        title: kind === "publish" ? "Venue published" : "Venue unpublished",
        tone: kind === "publish" ? "success" : "default",
      });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return isPublished ? (
    <Button variant="outline" size="sm" loading={busy} onClick={() => act("unpublish")}>
      Unpublish
    </Button>
  ) : (
    <Button size="sm" loading={busy} onClick={() => act("publish")}>
      Publish
    </Button>
  );
}
