import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem {
  label: string;
  value: string;
  href: string;
}

export function Tabs({
  tabs,
  activeValue,
  className,
}: {
  tabs: TabItem[];
  activeValue: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex overflow-x-auto border-b border-black/5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      aria-label="Page sections"
    >
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          scroll={false}
          aria-current={t.value === activeValue ? "page" : undefined}
          className={cn(
            "shrink-0 px-4 py-3 text-sm font-semibold transition-colors",
            t.value === activeValue
              ? "border-b-2 border-brand-600 text-ink"
              : "text-muted hover:text-ink-soft",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
