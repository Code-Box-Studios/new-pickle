"use client";

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
    <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {STEPS.map((s, i) => {
        const href = `/owner/venues/${venueId}/${s.k}`;
        const active = pathname === href;
        return (
          <Link
            key={s.k}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : done[s.k]
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-black/10 text-ink-soft hover:bg-black/5",
            )}
          >
            {done[s.k] ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <span className="text-xs opacity-70">{i + 1}</span>
            )}
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
