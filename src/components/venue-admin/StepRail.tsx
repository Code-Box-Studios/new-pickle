"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPS = [
  { k: "details", label: "Details" },
  { k: "photos", label: "Photos" },
  { k: "courts", label: "Courts" },
  { k: "hours", label: "Hours" },
  { k: "payments", label: "Payments" },
  { k: "review", label: "Review" },
] as const;

export function StepRail({
  venueId,
  done,
}: {
  venueId: string;
  done: Record<string, boolean>;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Venue setup steps"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
    >
      {STEPS.map((s, i) => {
        const href = `/owner/venues/${venueId}/${s.k}`;
        const active = pathname === href;
        return (
          <Button
            key={s.k}
            asChild
            variant="ghost"
            className={cn(
              "h-auto p-0",
              "flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              active
                ? "border-brand-700 bg-brand-700 text-white"
                : done[s.k]
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-line bg-surface text-ink-soft hover:bg-mist",
            )}
          >
            <Link href={href} aria-current={active ? "step" : undefined}>
              {done[s.k] ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <span className="text-xs opacity-70">{i + 1}</span>
              )}
              {s.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
