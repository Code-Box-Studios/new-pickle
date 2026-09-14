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
    <div
      className={cn(
        "rounded-2xl border border-black/5 bg-white p-4 shadow-[var(--shadow-card)]",
        urgent && "border-amber-200 bg-amber-50",
      )}
    >
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-extrabold",
          urgent ? "text-amber-800" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
