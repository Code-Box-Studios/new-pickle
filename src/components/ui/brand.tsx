import { cn } from "@/lib/cn";

export function Brand({ inverse, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-xl font-semibold tracking-[-0.045em]", inverse ? "text-white" : "text-ink", className)}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px]", inverse ? "bg-white/10 text-accent" : "bg-brand-700 text-white")}>
        <svg viewBox="0 0 24 24" className="size-[23px]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M5 9h14M5 15h14M12 3v6M12 15v6" />
        </svg>
      </span>
      RallyPoint
    </span>
  );
}
