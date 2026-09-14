import { cn } from "@/lib/cn";

export function SectionHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-sm font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </h2>
  );
}
