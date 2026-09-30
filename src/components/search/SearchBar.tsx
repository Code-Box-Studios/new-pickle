"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Clock3, MapPin, Search, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DURATIONS, TIME_PRESETS } from "@/lib/search-params";

export function SearchBar({
  cities,
  defaultCity,
  defaultDate,
  defaultTime = "any",
  defaultDuration = "60",
}: {
  cities: string[];
  defaultCity: string;
  defaultDate: string;
  defaultTime?: string;
  defaultDuration?: string;
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
    <Card className="relative p-4 shadow-elevated sm:p-5 lg:p-6">
    <form
      onSubmit={submit}
      aria-label="Find available courts"
      className="grid grid-cols-2 gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <label className="col-span-2 block min-w-0 sm:col-span-1">
        <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
          <MapPin className="size-3.5 text-brand-600" aria-hidden />
          Location
        </span>
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </label>
      <label className="col-span-2 block min-w-0 sm:col-span-1">
        <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
          <CalendarDays className="size-3.5 text-brand-600" aria-hidden />
          Date
        </span>
        <Input type="date" className="min-w-0" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="block min-w-0">
        <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
          <Clock3 className="size-3.5 text-brand-600" aria-hidden />
          Time
        </span>
        <Select value={time} onChange={(e) => setTime(e.target.value)}>
          {TIME_PRESETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="block min-w-0">
        <span className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-soft">
          <Timer className="size-3.5 text-brand-600" aria-hidden />
          Duration
        </span>
        <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" size="lg" loading={pending} className="col-span-2 lg:col-span-1">
        <Search className="size-4" aria-hidden />
        Find courts
      </Button>
    </form>
    </Card>
  );
}
