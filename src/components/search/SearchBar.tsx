"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ city, date, time, duration });
    router.push(`/search?${p.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
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
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Date
        </span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
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
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
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
      <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-1">
        <Search className="size-4" aria-hidden />
        Find courts
      </Button>
    </form>
  );
}
