"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DURATIONS } from "@/lib/search-params";
import { cn } from "@/lib/cn";

export function SessionDurationPicker({
  slug,
  dateStr,
  duration,
}: {
  slug: string;
  dateStr: string;
  duration: string;
}) {
  const router = useRouter();
  const longerDurations = DURATIONS.slice(3);
  const longerSelected = longerDurations.some((item) => item.value === duration);
  const durationUrl = (value: string) =>
    `/venues/${slug}?date=${dateStr}&duration=${value}`;

  return (
    <div
      className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4"
      role="group"
      aria-label="Booking duration"
    >
      {DURATIONS.slice(0, 3).map((item) => {
        const active = item.value === duration;
        return (
          <Button
            key={item.value}
            asChild
            variant={active ? "secondary" : "outline"}
            className={cn(
              "min-w-0 gap-1 px-2 text-sm",
              active &&
                "border-brand-700/40 bg-secondary text-brand-700 ring-1 ring-brand-700/10",
            )}
          >
            <Link
              href={durationUrl(item.value)}
              scroll={false}
              aria-current={active ? "true" : undefined}
            >
              {item.label}
            </Link>
          </Button>
        );
      })}
      <div className="col-span-3 min-w-0 min-[480px]:col-span-1">
        <Select
          value={longerSelected ? duration : ""}
          onValueChange={(value) =>
            router.push(durationUrl(value), { scroll: false })
          }
        >
          <SelectTrigger
            aria-label="Longer session length"
            className={cn(
              "rounded-full px-2 text-sm font-semibold",
              longerSelected &&
                "border-brand-700/40 bg-secondary text-brand-700 ring-1 ring-brand-700/10",
            )}
          >
            <SelectValue placeholder="Longer" />
          </SelectTrigger>
          <SelectContent>
            {longerDurations.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
