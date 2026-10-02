"use client";

import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Clock3, MapPin, Search, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, SelectItem } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CityPicker } from "@/components/search/CityPicker";
import type { CityOption } from "@/lib/cities";
import { CourtPattern, PickleballIcon } from "@/components/ui/pickleball";
import { DURATIONS, TIME_PRESETS } from "@/lib/search-params";

export function SearchBar({
  cities,
  defaultCity,
  defaultDate,
  defaultTime = "any",
  defaultDuration = "60",
  heading,
}: {
  cities: CityOption[];
  defaultCity: string;
  defaultDate: string;
  defaultTime?: string;
  defaultDuration?: string;
  heading?: string;
}) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);
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
          <h2 className="text-base font-semibold tracking-tight text-ink">{heading}</h2>
          <CourtPattern className="pointer-events-none absolute -right-5 -top-8 hidden w-40 rotate-[-20deg] text-brand-700 opacity-[0.08] sm:block" />
        </div>
      )}
      <form
        onSubmit={submit}
        aria-label="Find available courts"
        className="relative grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end lg:gap-5"
      >
        <div className="col-span-2 block min-w-0 sm:col-span-1">
          <Label htmlFor="search-city" className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
            <MapPin className="size-3.5 text-brand-600" aria-hidden />
            Location
          </Label>
          <CityPicker id="search-city" cities={cities} value={city} onValueChange={setCity} />
        </div>
        <div className="col-span-2 block min-w-0 sm:col-span-1">
          <Label htmlFor="search-date" className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
            <CalendarDays className="size-3.5 text-brand-600" aria-hidden />
            Date
          </Label>
          <DatePicker
            id="search-date"
            value={date}
            onValueChange={setDate}
          />
        </div>
        <Label className="block min-w-0">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
            <Clock3 className="size-3.5 text-brand-600" aria-hidden />
            Time
          </span>
          <SelectField value={time} onValueChange={(value) => setTime(value)}>
            {TIME_PRESETS.map((t) => (
              <SelectItem key={t.value} value={String(t.value)}>
                {t.label}
              </SelectItem>
            ))}
          </SelectField>
        </Label>
        <Label className="block min-w-0">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
            <Timer className="size-3.5 text-brand-600" aria-hidden />
            Duration
          </span>
          <SelectField
            value={duration}
            onValueChange={(value) => setDuration(value)}
          >
            {DURATIONS.map((d) => (
              <SelectItem key={d.value} value={String(d.value)}>
                {d.label}
              </SelectItem>
            ))}
          </SelectField>
        </Label>
        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="col-span-2 lg:col-span-1"
        >
          <Search className="size-4" aria-hidden />
          Find courts
        </Button>
      </form>
    </Card>
  );
}
