import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { PageLoading } from "@/components/ui/page-loading";
import { listCities } from "@/lib/venues";
import {
  DURATIONS,
  TIME_PRESETS,
  philippineDate,
  quickDateChoices,
} from "@/lib/search-params";
import { isoDate, longDateLabel, parseIsoDate } from "@/lib/format";
import { DEFAULT_CITY } from "@/lib/cities";
import { isPreviewMode } from "@/lib/deployment";

export const metadata: Metadata = {
  title: "Search courts",
  description:
    "Find available pickleball courts across Philippine cities by date and time.",
};
function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams,
    cities = await listCities();
  const todayDate = philippineDate(new Date()),
    tomorrow = quickDateChoices(todayDate)[1].value;
  const requestedCity = first(sp.city),
    requestedDate = first(sp.date);
  const city = cities.some((c) => c.value === requestedCity)
    ? requestedCity!
    : DEFAULT_CITY;
  const validDate =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    Number.isFinite(parseIsoDate(requestedDate).getTime()) &&
    isoDate(parseIsoDate(requestedDate)) === requestedDate;
  const dateStr = validDate
    ? requestedDate < todayDate
      ? todayDate
      : requestedDate
    : tomorrow;
  const timePreset =
    TIME_PRESETS.find((p) => p.value === first(sp.time))?.value ?? "any";
  const duration =
    DURATIONS.find((d) => d.value === first(sp.duration))?.value ?? "60";
  const key = `${city}:${dateStr}:${timePreset}:${duration}`;
  return (
    <div className="page-shell py-6 sm:py-8 lg:py-10">
      <SearchBar
        key={`form:${key}`}
        cities={cities}
        defaultCity={city}
        defaultDate={dateStr}
        todayDate={todayDate}
        defaultTime={timePreset}
        defaultDuration={duration}
      />
      <Suspense
        key={`results:${key}`}
        fallback={
          <div className="mt-9">
            <h1 className="page-title">Courts in {city}</h1>
            <p className="page-description mt-3">
              {longDateLabel(parseIsoDate(dateStr))} · Finding available courts
            </p>
            <PageLoading />
          </div>
        }
      >
        <SearchResults
          city={city}
          dateStr={dateStr}
          timePreset={timePreset}
          durationMinutes={Number(duration)}
          preview={isPreviewMode()}
        />
      </Suspense>
    </div>
  );
}
