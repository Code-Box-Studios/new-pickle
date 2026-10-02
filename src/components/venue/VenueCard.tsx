import Link from "next/link";
import { ArrowUpRight, ImageOff, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pesos, timeLabel } from "@/lib/format";
import type { Slot } from "@/lib/availability/engine";
import { cn } from "@/lib/cn";
import { VenueImage } from "./VenueImage";

export interface VenueCardData {
  slug: string;
  name: string;
  barangay: string | null;
  city: string;
  photos: string[];
  ratingAvg: number;
  ratingCount: number;
  indoor: boolean;
  courtCount: number;
  priceFromCents: number | null;
}

export function VenueCard({
  venue,
  nextSlots,
  isoDate,
}: {
  venue: VenueCardData;
  nextSlots?: Slot[];
  isoDate?: string;
}) {
  const photo = venue.photos[0];
  const href = isoDate
    ? `/venues/${venue.slug}?date=${isoDate}`
    : `/venues/${venue.slug}`;

  return (
    <div className="court-photo-hover h-full">
      <Card className="court-photo-card h-full shadow-none hover:border-brand-200">
        <Link
          href={href}
          className="motion-trigger relative block h-full overflow-hidden rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-mist">
            {photo ? (
              <VenueImage
                src={photo}
                alt={venue.name}
                className="court-photo-image size-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <ImageOff className="size-6" strokeWidth={1.5} aria-hidden />
                No photo
              </div>
            )}
            <Badge
              variant="ghost"
              className="absolute left-4 top-4 bg-white/95 px-3 py-1.5 text-xs font-medium text-ink"
            >
              {venue.indoor ? "Indoor" : "Outdoor"} · {venue.courtCount} court
              {venue.courtCount === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="venue-card-details p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-ink">
                {venue.name}
              </h3>
              {venue.ratingCount > 0 ? (
                <span
                  className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-ink-soft"
                  aria-label={`${venue.ratingAvg.toFixed(1)} out of 5, ${venue.ratingCount} reviews`}
                >
                  <Star
                    className="size-3.5 fill-brand-700 text-brand-700"
                    aria-hidden
                  />
                  <span className="font-semibold text-ink">
                    {venue.ratingAvg.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    ({venue.ratingCount})
                  </span>
                </span>
              ) : (
                <Badge tone="brand" className="text-xs">
                  New venue
                </Badge>
              )}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
              <MapPin className="mt-1 size-3.5 shrink-0" aria-hidden />
              <span>
                {venue.barangay ? `${venue.barangay}, ` : ""}
                {venue.city}
              </span>
            </p>
            <div className="mt-5 flex min-h-10 items-center justify-between gap-3 border-t border-line pt-4">
              {venue.priceFromCents != null ? (
                <p className="text-sm text-muted-foreground">
                  From{" "}
                  <span className="text-lg font-semibold tracking-tight text-ink">
                    {pesos(venue.priceFromCents)}
                  </span>
                  <span className="ml-1 text-xs">/hr</span>
                </p>
              ) : (
                <span className="text-sm text-muted-foreground">
                  View venue details
                </span>
              )}
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-brand-700">
                <ArrowUpRight
                  className="motion-arrow size-4"
                  data-direction="up-right"
                  aria-hidden
                />
              </span>
            </div>

            {nextSlots && nextSlots.length > 0 && (
              <div
                className="mt-4 flex flex-wrap gap-2"
                aria-label="Next available times"
              >
                {nextSlots.map((s) => (
                  <Badge
                    variant="secondary"
                    key={s.startsAt.toISOString()}
                    className={cn(
                      "rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-800",
                    )}
                  >
                    {timeLabel(s.startsAt)}
                  </Badge>
                ))}
              </div>
            )}
            {nextSlots && nextSlots.length === 0 && (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                No open slots for this time
              </p>
            )}
          </div>
        </Link>
      </Card>
    </div>
  );
}
