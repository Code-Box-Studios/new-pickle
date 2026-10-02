"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "./api";
import { VenueImage } from "@/components/venue/VenueImage";

export function PhotoManager({
  venueId,
  initial,
  locked,
}: {
  venueId: string;
  initial: string[];
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/owner/venues/${venueId}/photos`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotos(data.photos);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: (err as Error).message,
        tone: "error",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function mutate(method: "DELETE" | "PATCH", photo: string) {
    setBusy(true);
    try {
      const data = await sendJson(
        `/api/owner/venues/${venueId}/photos`,
        method,
        { photo },
      );
      setPhotos(data.photos);
    } catch (err) {
      toast({
        title: "Couldn't update",
        description: (err as Error).message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add clear photos of your courts. The first photo is your cover.
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div
              key={p}
              className="group relative overflow-hidden rounded-lg border border-line"
            >
              <VenueImage
                src={p}
                alt={`Photo ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Cover
                </span>
              )}
              {!locked && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/40 p-1.5">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => mutate("PATCH", p)}
                    disabled={busy || i === 0}
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/95 text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-40"
                    aria-label="Set as cover"
                  >
                    <Star className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => mutate("DELETE", p)}
                    disabled={busy}
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/95 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-40"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <Label
          htmlFor={`venue-photo-${venueId}`}
          className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-canvas p-4 hover:bg-mist focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2"
        >
          <ImagePlus className="size-5 shrink-0 text-brand-700" aria-hidden />
          <span className="text-sm text-ink-soft">
            {busy ? "Uploading…" : "Upload a photo (JPG, PNG, WebP · max 5 MB)"}
          </span>
          <Input
            id={`venue-photo-${venueId}`}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </Label>
      )}

      {!locked && (
        <Button
          size="lg"
          block
          onClick={() => {
            router.push(`/owner/venues/${venueId}/courts`);
            router.refresh();
          }}
        >
          Continue
        </Button>
      )}
    </div>
  );
}
