"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VenueImage } from "./VenueImage";

export function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-mist text-sm text-muted-foreground">
        No photos yet
      </div>
    );
  }
  const move = (offset: number) =>
    setIndex((current) => (current + offset + photos.length) % photos.length);
  const controls = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outlineOnDark"
        size="icon"
        aria-label="Previous photo"
        onClick={() => move(-1)}
        className="border-white/20 bg-brand-950/65"
      >
        <ArrowLeft aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outlineOnDark"
        size="icon"
        aria-label="Next photo"
        onClick={() => move(1)}
        className="border-white/20 bg-brand-950/65"
      >
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );
  return (
    <Dialog>
      <div className="court-photo-frame relative overflow-hidden rounded-xl">
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="View venue photos"
            className="block h-auto w-full overflow-hidden rounded-xl p-0"
          >
            <VenueImage
              src={photos[index]}
              alt={`${name}, photo ${index + 1}`}
              className="court-photo-image aspect-[4/3] w-full object-cover"
            />
            <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/20 bg-brand-950/75 px-3 py-2 text-xs font-medium text-white backdrop-blur">
              <Images className="size-3.5" aria-hidden />
              <span aria-live="polite">
                {index + 1} / {photos.length}
              </span>
            </span>
          </Button>
        </DialogTrigger>
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3">{controls}</div>
        )}
      </div>
      <DialogContent
        className="max-w-[calc(100%-24px)] gap-4 p-4 sm:max-w-4xl sm:p-6"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
        }}
      >
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{name} photos</DialogTitle>
          <DialogDescription>
            Photo {index + 1} of {photos.length}. Use the arrows to explore.
          </DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-xl bg-brand-950">
          <VenueImage
            src={photos[index]}
            alt={`${name}, photo ${index + 1}`}
            className="max-h-[65dvh] min-h-48 w-full object-contain"
          />
          {photos.length > 1 && (
            <div className="absolute bottom-3 right-3">{controls}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
