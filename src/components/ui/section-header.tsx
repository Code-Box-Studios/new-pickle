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
        "text-base font-semibold tracking-tight text-ink",
        className,
      )}
    >
      {children}
    </h2>
  );
}
