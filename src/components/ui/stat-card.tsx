import { Card } from "./card";
import { cn } from "@/lib/cn";

export function StatCard({
  icon,
  label,
  value,
  urgent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "rounded-[var(--radius-card)] border border-line/80 bg-surface p-5 shadow-card sm:p-6",
        urgent && "border-amber-200 bg-amber-50",
      )}
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-brand-700",
            urgent && "bg-amber-100 text-amber-800",
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "mt-4 break-words text-2xl font-medium tracking-[-0.035em] tabular-nums sm:text-3xl",
          urgent ? "text-amber-800" : "text-ink",
        )}
      >
        {value}
      </p>
    </Card>
  );
}
