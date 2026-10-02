import { cn } from "@/lib/cn";

export interface LegendItem {
  /** Tailwind bg-* class for the color dot, e.g. "bg-brand-500". */
  dotClass: string;
  label: string;
}

export function Legend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className={cn("size-2.5 rounded-sm", item.dotClass)}
            aria-hidden
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
