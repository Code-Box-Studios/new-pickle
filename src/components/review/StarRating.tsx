"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function StarRating({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "lg";
}) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  const px = size === "lg" ? "size-9" : "size-6";
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button
          variant="ghost"
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Star
            className={cn(
              px,
              n <= shown ? "fill-brand-700 text-brand-700" : "text-slate-300",
            )}
            aria-hidden
          />
        </Button>
      ))}
    </div>
  );
}
