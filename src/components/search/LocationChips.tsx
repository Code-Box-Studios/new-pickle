"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LocateFixed, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CityOption } from "@/lib/cities";
import { nearbyCities, suggestionsForCity } from "@/lib/location/nearby-cities";

const STORAGE_KEY = "pikol-nearby-cities";
const MAX_AGE = 5 * 60_000;
interface LocatedCities {
  cityValues: string[];
  obtainedAt: number;
}
function readLocation(cities: CityOption[]): LocatedCities | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      stored &&
      typeof stored.obtainedAt === "number" &&
      stored.obtainedAt <= Date.now() &&
      Date.now() - stored.obtainedAt < MAX_AGE &&
      Array.isArray(stored.cityValues) &&
      stored.cityValues.length > 0 &&
      stored.cityValues.length <= 4 &&
      stored.cityValues.every(
        (value: unknown) =>
          typeof value === "string" && cities.some((c) => c.value === value),
      )
    )
      return stored;
  } catch {
    /* Location shortcuts also work when browser storage is disabled. */
  }
  return null;
}

export function LocationChips({
  cities,
  city,
  onCityChange,
  onSearchCity,
  pending,
}: {
  cities: CityOption[];
  city: string;
  onCityChange: (value: string) => void;
  onSearchCity: (value: string) => void;
  pending: boolean;
}) {
  const [located, setLocated] = useState<LocatedCities | null>(null);
  const [locating, setLocating] = useState<"fill" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const handlers = useRef({ onCityChange, onSearchCity });
  useEffect(() => {
    handlers.current = { onCityChange, onSearchCity };
  }, [onCityChange, onSearchCity]);
  useEffect(() => {
    mounted.current = true;
    // Defer the client-only storage read until hydration has finished.
    const timer = window.setTimeout(() => setLocated(readLocation(cities)), 0);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
    };
  }, [cities]);

  function requestLocation(action: "fill" | "search") {
    setError(null);
    const cached = readLocation(cities);
    if (action === "search" && cached) {
      setLocated(cached);
      onCityChange(cached.cityValues[0]);
      onSearchCity(cached.cityValues[0]);
      return;
    }
    if (!navigator.geolocation) {
      setError(
        "Location isn’t available on this browser. Choose a city above.",
      );
      return;
    }
    setLocating(action);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        const results = nearbyCities(position.coords, cities);
        setLocating(null);
        if (!results.length) {
          setError(
            "We couldn’t find a Philippine city nearby. Choose a city above.",
          );
          return;
        }
        const next = {
          cityValues: results.map((r) => r.city.value),
          obtainedAt: Date.now(),
        };
        // Retain only city names for five minutes, never precise GPS coordinates.
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* Optional cache. */
        }
        setLocated(next);
        handlers.current.onCityChange(next.cityValues[0]);
        if (action === "search")
          handlers.current.onSearchCity(next.cityValues[0]);
      },
      (failure) => {
        if (!mounted.current) return;
        setLocating(null);
        setError(
          failure.code === 1
            ? "Location access is off. Allow it in your browser or choose a city above."
            : failure.code === 3
              ? "Finding your location took too long. Try again or choose a city above."
              : "We couldn’t get your location. Try again or choose a city above.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: MAX_AGE },
    );
  }

  const anchor = located?.cityValues[0] ?? city;
  const suggestions = located
    ? located.cityValues
        .filter((value) => value !== city)
        .map((value) => cities.find((c) => c.value === value)!)
        .slice(0, 3)
    : suggestionsForCity(city, cities).map((r) => r.city);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Location shortcuts"
      >
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="min-h-11 gap-1.5 border-brand-200/80 text-brand-700"
          aria-label="Current location"
          loading={locating === "fill"}
          loadingLabel="Locating"
          disabled={pending || !!locating}
          onClick={() => requestLocation("fill")}
        >
          <LocateFixed className="size-3.5" aria-hidden />
          Current location
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="min-h-11 gap-1.5"
          aria-label="Near me"
          loading={locating === "search"}
          loadingLabel="Locating"
          disabled={pending || !!locating}
          onClick={() => requestLocation("search")}
        >
          <Navigation className="size-3.5" aria-hidden />
          Near me
          <ArrowUpRight className="size-3" aria-hidden />
        </Button>
        <span className="text-[11px] leading-relaxed text-muted-foreground sm:ml-1">
          Find a city. Get to the game.
        </span>
      </div>
      {suggestions.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
          role="group"
          aria-label="Suggested nearby cities"
        >
          <span className="mr-1 text-xs text-muted-foreground">
            Near {anchor}
          </span>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.value}
              type="button"
              variant="ghost"
              size="xs"
              className="min-h-11 max-w-full gap-1.5 bg-surface/70 px-3 font-medium text-ink-soft"
              aria-label={`Search courts in ${suggestion.value}`}
              title={suggestion.province}
              disabled={pending || !!locating}
              onClick={() => {
                onCityChange(suggestion.value);
                onSearchCity(suggestion.value);
              }}
            >
              <MapPin className="size-3 shrink-0 text-brand-700" aria-hidden />
              <span className="truncate">{suggestion.value}</span>
            </Button>
          ))}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {locating && (
          <p role="status" className="text-xs text-muted-foreground">
            Finding nearby cities… Allow location access when your browser asks.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs leading-relaxed text-destructive">
            {error}
          </p>
        )}
        {!locating && !error && located && (
          <p className="sr-only" role="status">
            Location found. Nearest city: {located.cityValues[0]}.
          </p>
        )}
      </div>
    </div>
  );
}
