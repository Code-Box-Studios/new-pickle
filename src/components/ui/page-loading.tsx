import { Skeleton } from "./skeleton";

/** Route loading feedback that fits both the marketplace and venue workspace. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading page" className="w-full space-y-6 py-6">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div aria-hidden="true" className="space-y-5 rounded-2xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    </div>
  );
}
