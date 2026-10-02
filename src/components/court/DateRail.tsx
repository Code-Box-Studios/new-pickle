"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/cn";

export interface DayChip {
  iso: string;
  weekday: string;
  label: string;
}

/**
 * Horizontal date carousel for the venue booking section. Renders the same
 * server-navigating <Link> chips as before (each href re-runs availability via
 * searchParams). The calendar extends the date range; the active chip scrolls
 * into view without moving the page.
 */
export function DateRail({
  days,
  slug,
  dateStr,
  duration,
  minDate,
  tab,
}: {
  days: DayChip[];
  slug: string;
  dateStr: string;
  duration: string;
  minDate?: string;
  tab?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();
  const dateUrl = (date: string) =>
    `/venues/${slug}?date=${date}&duration=${duration}${tab ? `&tab=${tab}` : ""}`;

  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const delta =
      elRect.left + elRect.width / 2 - (cRect.left + cRect.width / 2);
    // No smooth behavior — instant, so it's reduced-motion safe and doesn't jar.
    container.scrollBy({ left: delta });
  }, [dateStr]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs text-brand-700">
            1
          </span>{" "}
          Choose your day
        </p>
        <div className="w-full min-[380px]:w-auto">
          <DatePicker
            aria-label="Choose another date"
            value={dateStr}
            minDate={minDate ?? days[0]?.iso}
            onValueChange={(date) =>
              router.push(dateUrl(date), { scroll: false })
            }
            className="h-11 text-sm"
          />
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex w-full max-w-full snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Choose a booking date"
      >
        {days.map((d) => {
          const active = d.iso === dateStr;
          return (
            <Button
              key={d.iso}
              asChild
              variant="ghost"
              className={cn(
                "h-auto p-0",
                "flex min-h-18 w-18 shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                active
                  ? "border-brand-700 bg-brand-700 text-white shadow-[0_4px_12px_-4px_rgb(0_104_74/0.3)] hover:bg-brand-700"
                  : "border-line bg-white text-ink-soft hover:border-brand-300 hover:bg-mist",
              )}
            >
              <Link
                ref={active ? activeRef : undefined}
                href={dateUrl(d.iso)}
                scroll={false}
                aria-current={active ? "date" : undefined}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {d.weekday}
                </span>
                <span className="text-sm font-semibold">{d.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
