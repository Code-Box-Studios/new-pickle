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
import { MAX_PROOF_BYTES } from "@/lib/storage/proof-storage";
import { SetupActions } from "./SetupActions";

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
      if (file.size > MAX_PROOF_BYTES) {
        throw new Error("Image is too large (max 4 MB).");
      }
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-ink">Venue gallery</p>
        <p className="text-muted-foreground">
          {photos.length} {photos.length === 1 ? "photo" : "photos"} · First
          photo is your cover
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div
              key={p}
              className="group relative overflow-hidden rounded-lg border border-line"
            >
              <VenueImage
                src={p}
                alt={`Photo ${i + 1}`}
                className="aspect-[4/3] w-full object-cover"
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
                    className="grid size-11 shrink-0 place-items-center bg-white/95 p-0 text-ink hover:bg-white disabled:opacity-40"
                    aria-label="Set as cover"
                  >
                    <Star className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => mutate("DELETE", p)}
                    disabled={busy}
                    className="grid size-11 shrink-0 place-items-center bg-white/95 p-0 text-red-600 hover:bg-red-50 disabled:opacity-40"
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
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-brand-200 bg-mist/30 p-6 text-center transition-colors hover:bg-mist/60 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2"
        >
          <span className="grid size-14 place-items-center rounded-full border border-brand-200 bg-white">
            <ImagePlus className="size-6 text-brand-700" aria-hidden />
          </span>
          <span className="text-base font-semibold text-ink">
            {busy ? "Uploading…" : "Upload a photo"}
          </span>
          <span className="max-w-sm text-sm font-normal leading-relaxed text-muted-foreground">
            Show off your courts, your space, and the atmosphere.
            <br />
            JPG, PNG, or WebP · up to 4 MB each
          </span>
          <span className="mt-1 rounded-full bg-brand-950 px-5 py-2.5 text-sm font-medium text-white">
            {busy ? "Please wait" : "Choose a photo"}
          </span>
          <Input
            id={`venue-photo-${venueId}`}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            className="sr-only!"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </Label>
      )}

      {!locked && (
        <SetupActions
          venueId={venueId}
          back="details"
          label="Continue to courts"
          disabled={busy}
          onContinue={() => {
            router.push(`/owner/venues/${venueId}/courts`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
