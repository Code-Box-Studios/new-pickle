import type { Metadata } from "next";
import { SearchBar } from "@/components/search/SearchBar";
import { VenueCard } from "@/components/venue/VenueCard";
import { EmptyState } from "@/components/ui/states";
import { SearchX } from "lucide-react";
import { listCities } from "@/lib/venues";
import { searchAvailability } from "@/lib/availability/engine";
import { cached } from "@/lib/availability/cache";
import { resolveTimeWindow } from "@/lib/search-params";
import { isoDate, longDateLabel, parseIsoDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search courts",
  description: "Find available pickleball courts in Davao by date and time.",
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const cities = await listCities();
  const cityOptions = cities.length ? cities : ["Davao City"];

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const city = first(sp.city) ?? cityOptions[0];
  const dateStr = first(sp.date) ?? isoDate(tomorrow);
  const timePreset = first(sp.time) ?? "any";
  const duration = first(sp.duration) ?? "60";
  const date = parseIsoDate(dateStr);
  const { from, to } = resolveTimeWindow(timePreset);
  const durationMinutes = Number(duration) || 60;

  const key = `search:${city}:${dateStr}:${timePreset}:${durationMinutes}`;
  const results = await cached(key, 45_000, () =>
    searchAvailability({ city, date, fromMinute: from, toMinute: to, durationMinutes }),
  );
  const withOpenings = results.filter((r) => r.nextSlots.length > 0).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <SearchBar
        cities={cityOptions}
        defaultCity={city}
        defaultDate={dateStr}
        defaultTime={timePreset}
        defaultDuration={duration}
      />

      <div className="mt-6 mb-4">
        <h1 className="text-lg font-bold text-ink">
          Courts in {city}
        </h1>
        <p className="text-sm text-muted">
          {longDateLabel(date)} · {withOpenings} of {results.length} venue
          {results.length === 1 ? "" : "s"} with openings
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title="No venues here yet"
          description="We couldn't find venues in this area. Try another city."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
