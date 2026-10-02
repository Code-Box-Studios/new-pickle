import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading courts"
      className="page-shell space-y-8 py-12"
    >
      <div className="space-y-3">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
          >
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-5 h-5 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
