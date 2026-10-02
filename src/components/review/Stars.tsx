import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/** Read-only star row. Rounds to the nearest whole star for display. */
export function Stars({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const filled = Math.round(value);
  return (
    <div
      className={cn("flex gap-0.5", className)}
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= filled ? "fill-brand-700 text-brand-700" : "text-slate-300",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
