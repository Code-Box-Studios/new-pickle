"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETUP_STEPS } from "./setup-steps";

export function StepRail({
  venueId,
  done,
}: {
  venueId: string;
  done: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const railRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!rail || !active) return;
    const parent = rail.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < parent.left || item.right > parent.right) {
      rail.scrollLeft +=
        item.left - parent.left - (parent.width - item.width) / 2;
    }
  }, [pathname]);
  const completed = SETUP_STEPS.filter(
    (step) => step.key !== "review" && done[step.key],
  ).length;
  return (
    <div className="rounded-lg border border-line bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs">
        <span className="font-medium text-ink">Your venue setup</span>
        <span className="text-muted-foreground">
          {completed} of 5 sections ready
        </span>
      </div>
      <nav
        ref={railRef}
        aria-label="Venue setup steps"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {SETUP_STEPS.map((s, i) => {
          const href = `/owner/venues/${venueId}/${s.key}`;
          const active = pathname === href;
          const completed = s.key !== "review" && done[s.key];
          return (
            <Button
              key={s.key}
              asChild
              variant="ghost"
              className={cn(
                "h-12 min-w-28 flex-1 gap-2.5 border px-3 text-sm font-medium sm:px-4",
                active
                  ? "border-brand-950 bg-brand-950 text-white hover:bg-brand-950"
                  : "border-transparent bg-canvas text-ink-soft hover:border-brand-200 hover:bg-mist",
              )}
            >
              <Link href={href} aria-current={active ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px]",
                    active
                      ? "bg-brand-500 text-brand-950"
                      : completed
                        ? "bg-mist text-brand-700"
                        : "bg-white text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {completed ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.label}
                {s.key === "review" && done.review && (
                  <ArrowUpRight className="size-3.5" aria-hidden />
                )}
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
