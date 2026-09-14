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
      className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              "flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 text-center transition",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-black/10 bg-white text-ink-soft hover:bg-black/5",
            )}
          >
            <span className={cn("text-[11px] font-medium", active ? "text-white/80" : "text-muted")}>
              {d.weekday}
            </span>
            <span className="text-sm font-semibold">{d.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
