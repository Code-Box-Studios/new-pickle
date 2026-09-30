"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface DayChip {
  iso: string;
  weekday: string;
  label: string;
}

/**
 * Horizontal date carousel for the venue booking section. Renders the same
 * server-navigating <Link> chips as before (each href re-runs availability via
 * searchParams) — the only additions are the compact styling and auto-scrolling
 * the active chip into view. Scrolls the container only, never the page.
 */
export function DateRail({
  days,
  slug,
  dateStr,
  duration,
  tab,
}: {
  days: DayChip[];
  slug: string;
  dateStr: string;
  duration: string;
  tab?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const delta = elRect.left + elRect.width / 2 - (cRect.left + cRect.width / 2);
    // No smooth behavior — instant, so it's reduced-motion safe and doesn't jar.
    container.scrollBy({ left: delta });
  }, [dateStr]);

  return (
    <div
      ref={scrollRef}
      className="flex w-full max-w-full snap-x gap-2 overflow-x-auto px-4 pb-2 pt-1 md:px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Choose a booking date"
    >
      {days.map((d) => {
        const active = d.iso === dateStr;
        return (
          <Link
            key={d.iso}
            ref={active ? activeRef : undefined}
            href={`/venues/${slug}?date=${d.iso}&duration=${duration}${tab ? `&tab=${tab}` : ""}`}
            scroll={false}
            aria-current={active ? "date" : undefined}
            className={cn(
              "flex min-h-18 w-18 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              active
                ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                : "border-line bg-surface text-ink-soft hover:border-brand-300 hover:bg-mist",
            )}
          >
            <span className={cn("text-xs font-medium", active ? "text-white/80" : "text-muted")}>
              {d.weekday}
            </span>
            <span className="text-sm font-semibold">{d.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
