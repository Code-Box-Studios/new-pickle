"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ArrowUpRight, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [open, setOpen] = useState(false);
  const currentIndex = Math.max(
    0,
    SETUP_STEPS.findIndex((step) => pathname.endsWith(`/${step.key}`)),
  );
  const current = SETUP_STEPS[currentIndex];
  const CurrentIcon = current.icon;
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
    <>
      <div className="lg:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-label={`Choose setup step: ${current.label}, step ${currentIndex + 1} of 6`}
              className="h-14 w-full justify-start gap-3 border-line bg-white px-4 font-medium shadow-none"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mist text-brand-700">
                <CurrentIcon className="size-4" aria-hidden />
              </span>
              <span className="text-ink">{current.label}</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Step {currentIndex + 1} of 6
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label="Choose a setup step"
            className="w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height) overflow-y-auto p-2"
          >
            <nav aria-label="Choose a setup step" className="space-y-1">
              {SETUP_STEPS.map((step, index) => {
                const active = index === currentIndex;
                const Icon = step.icon;
                const complete = step.key !== "review" && done[step.key];
                return (
                  <Button
                    key={step.key}
                    asChild
                    variant="ghost"
                    className={cn(
                      "h-12 w-full justify-start gap-3 border px-3 font-medium",
                      active
                        ? "border-brand-200 bg-mist text-brand-800"
                        : "border-transparent text-ink-soft",
                    )}
                  >
                    <Link
                      href={`/owner/venues/${venueId}/${step.key}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="size-4" aria-hidden />
                      {step.label}
                      {complete ? (
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-700">
                          <Check className="size-3.5" aria-hidden /> Ready
                        </span>
                      ) : (
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          {index + 1}
                        </span>
                      )}
                    </Link>
                  </Button>
                );
              })}
            </nav>
            <p className="mt-2 border-t border-line px-3 pt-3 pb-1 text-xs text-muted-foreground">
              {completed} of 5 sections ready for review
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <div className="hidden rounded-lg border border-line bg-white p-4 lg:block">
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
    </>
  );
}
