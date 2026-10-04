"use client";

import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  Timer,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, SelectItem } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CityPicker } from "@/components/search/CityPicker";
import type { CityOption } from "@/lib/cities";
import { CourtPattern, PickleballIcon } from "@/components/ui/pickleball";
import { DURATIONS, TIME_PRESETS, quickDateChoices } from "@/lib/search-params";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/cn";

export function SearchBar({
  cities,
  defaultCity,
  defaultDate,
  todayDate,
  defaultTime = "any",
  defaultDuration = "60",
  heading,
}: {
  cities: CityOption[];
  defaultCity: string;
  defaultDate: string;
  todayDate: string;
  defaultTime?: string;
  defaultDuration?: string;
  heading?: string;
}) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);
  const [filtersOpen, setFiltersOpen] = useState(
    defaultTime !== "any" || defaultDuration !== "60",
  );
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ city, date, time, duration });
    startTransition(() => router.push(`/search?${p.toString()}`));
  }

  return (
    <Card className="search-panel relative overflow-hidden p-4 sm:p-5 lg:p-6">
      {heading && (
        <div className="relative mb-5 flex items-center gap-3 border-b border-border/70 pb-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-brand-700">
            <PickleballIcon className="size-5" />
          </span>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            {heading}
          </h2>
          <CourtPattern className="pointer-events-none absolute -right-5 -top-8 hidden w-40 rotate-[-20deg] text-brand-700 opacity-[0.08] sm:block" />
        </div>
      )}
      <form
        onSubmit={submit}
        aria-label="Find available courts"
        aria-busy={pending}
        className="relative space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Label
              htmlFor="search-city"
              className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft"
            >
              <MapPin className="size-3.5 text-brand-600" aria-hidden />
              Location
            </Label>
            <CityPicker
              id="search-city"
              cities={cities}
              value={city}
              onValueChange={setCity}
              className="h-12 rounded-xl bg-surface/40 px-4"
            />
          </div>
          <div className="min-w-0">
            <Label
              htmlFor="search-date"
              className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft"
            >
              <CalendarDays className="size-3.5 text-brand-600" aria-hidden />
              Date
            </Label>
            <DatePicker
              id="search-date"
              value={date}
              onValueChange={setDate}
              minDate={todayDate}
              className="h-12 rounded-xl bg-surface/40 px-4"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            loadingLabel="Searching"
            className="w-full sm:col-span-2 lg:col-span-1 lg:min-w-44"
          >
            <Search className="size-4" aria-hidden />
            Find courts
          </Button>
        </div>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="Quick search dates"
            >
              {quickDateChoices(todayDate).map((day) => (
                <Button
                  key={day.label}
                  type="button"
                  size="xs"
                  variant={date === day.value ? "secondary" : "ghost"}
                  aria-pressed={date === day.value}
                  disabled={pending}
                  onClick={() => setDate(day.value)}
                  className="px-3 font-medium"
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {TIME_PRESETS.find((p) => p.value === time)?.label} ·{" "}
                {DURATIONS.find((d) => d.value === duration)?.label}
              </span>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="gap-2 px-3 text-ink-soft"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Time &amp; duration
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-3.5 transition-transform motion-reduce:transition-none",
                      filtersOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 motion-reduce:animate-none">
            <div className="mt-4 grid items-end gap-4 rounded-xl border border-border/70 bg-surface/60 p-4 sm:grid-cols-[1fr_1fr_auto]">
              <div className="min-w-0">
                <Label htmlFor="search-time" className="mb-2">
                  <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
                    <Clock3 className="size-3.5 text-brand-600" aria-hidden />
                    Time
                  </span>
                </Label>
                <SelectField
                  id="search-time"
                  value={time}
                  onValueChange={(value) => setTime(value)}
                >
                  {TIME_PRESETS.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>
              <div className="min-w-0">
                <Label htmlFor="search-duration" className="mb-2">
                  <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
                    <Timer className="size-3.5 text-brand-600" aria-hidden />
                    Duration
                  </span>
                </Label>
                <SelectField
                  id="search-duration"
                  value={duration}
                  onValueChange={(value) => setDuration(value)}
                >
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={time === "any" && duration === "60"}
                onClick={() => {
                  setTime("any");
                  setDuration("60");
                }}
              >
                Reset filters
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>
    </Card>
  );
}
