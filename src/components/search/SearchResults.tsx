import { VenueCard } from "@/components/venue/VenueCard";
import { EmptyState } from "@/components/ui/states";
import { SearchX } from "lucide-react";
import { searchAvailability } from "@/lib/availability/engine";
import { cached } from "@/lib/availability/cache";
import { longDateLabel, parseIsoDate } from "@/lib/format";
import { resolveTimeWindow } from "@/lib/search-params";

export async function SearchResults({
  city,
  dateStr,
  timePreset,
  durationMinutes,
  preview,
}: {
  city: string;
  dateStr: string;
  timePreset: string;
  durationMinutes: number;
  preview: boolean;
}) {
  const date = parseIsoDate(dateStr),
    { from, to } = resolveTimeWindow(timePreset);
  const results = preview
    ? []
    : await cached(
        `search:${city}:${dateStr}:${timePreset}:${durationMinutes}`,
        45000,
        () =>
          searchAvailability({
            city,
            date,
            fromMinute: from,
            toMinute: to,
            durationMinutes,
          }),
      );
  const withOpenings = results.filter((r) => r.nextSlots.length > 0).length;
  return (
    <>
      <div className="mb-6 mt-9 sm:mb-8 sm:mt-10">
        <h1 className="page-title">Courts in {city}</h1>
        <p className="page-description mt-3">
          {longDateLabel(date)} ·{" "}
          {preview
            ? "Court bookings open soon"
            : `${withOpenings} of ${results.length} venue${results.length === 1 ? "" : "s"} with openings`}
        </p>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title={
            preview ? "Your next game is coming soon" : "No venues here yet"
          }
          description={
            preview
              ? "We're getting courts ready on Pikol. Check back soon to find your place to play."
              : "We couldn't find venues in this area. Try another city."
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {results.map((r) => (
            <VenueCard
              key={r.venue.slug}
              venue={{
                slug: r.venue.slug,
                name: r.venue.name,
                barangay: r.venue.barangay,
                city: r.venue.city,
                photos: r.venue.photos,
                ratingAvg: r.venue.ratingAvg,
                ratingCount: r.venue.ratingCount,
                indoor: r.venue.indoor,
                courtCount: r.courtCount,
                priceFromCents: r.priceFromCents,
              }}
              nextSlots={r.nextSlots}
              isoDate={dateStr}
              durationMinutes={durationMinutes}
            />
          ))}
        </div>
      )}
    </>
  );
}
