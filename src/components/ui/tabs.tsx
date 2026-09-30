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
        "flex gap-1 overflow-x-auto border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
            "min-h-12 shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            t.value === activeValue
              ? "border-brand-600 text-brand-800"
              : "border-transparent text-muted hover:border-line hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
