import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { pesos, timeLabel } from "@/lib/format";
import type { Slot } from "@/lib/availability/engine";
import { cn } from "@/lib/cn";

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
  const href = isoDate ? `/venues/${venue.slug}?date=${isoDate}` : `/venues/${venue.slug}`;

  return (
    <Card className="overflow-hidden transition hover:shadow-lg">
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={venue.name}
            className="size-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted">No photo</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          {venue.indoor ? "Indoor" : "Outdoor"} · {venue.courtCount} court
          {venue.courtCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-1.5 p-4">
        <div className="flex items-center gap-1 text-sm text-ink-soft">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-semibold text-ink">{venue.ratingAvg.toFixed(1)}</span>
          <span className="text-muted">({venue.ratingCount})</span>
        </div>
        <h3 className="text-[15px] font-bold text-ink">{venue.name}</h3>
        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-3.5" aria-hidden />
          {venue.barangay ? `${venue.barangay}, ` : ""}
          {venue.city}
        </p>
        {venue.priceFromCents != null && (
          <p className="text-sm font-semibold text-ink">
            From {pesos(venue.priceFromCents)}<span className="font-normal text-muted">/hr</span>
          </p>
        )}

        {nextSlots && nextSlots.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {nextSlots.map((s) => (
              <span
                key={s.startsAt.toISOString()}
                className={cn(
                  "rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800",
                )}
              >
                {timeLabel(s.startsAt)}
              </span>
            ))}
          </div>
        )}
        {nextSlots && nextSlots.length === 0 && (
          <p className="pt-2 text-xs font-medium text-muted">No open slots for this time</p>
        )}
      </div>
    </Link>
    </Card>
  );
}
