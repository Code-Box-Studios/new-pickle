import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/ui/states";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { VenueStatus } from "@/generated/prisma";

export const metadata = { title: "Admin · Venues" };

const FILTERS: { value: string; label: string; status?: VenueStatus }[] = [
  {
    value: "PENDING_REVIEW",
    label: "Pending review",
    status: "PENDING_REVIEW",
  },
  { value: "APPROVED", label: "Approved", status: "APPROVED" },
  { value: "REJECTED", label: "Rejected", status: "REJECTED" },
  { value: "SUSPENDED", label: "Suspended", status: "SUSPENDED" },
  { value: "ALL", label: "All" },
];

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.status) ?? FILTERS[0];

  const venues = await prisma.venue.findMany({
    where: filter.status ? { status: filter.status } : {},
    include: { owner: { select: { email: true } }, verification: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="page-title">Venues</h1>

      {/* Segmented control */}
      <div className="mt-6 overflow-x-auto pb-1">
        <nav
          aria-label="Venue status"
          className="inline-flex min-w-max gap-1 rounded-lg border border-line bg-surface p-1.5"
        >
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              asChild
              variant="ghost"
              className={cn(
                "h-auto p-0",
                "flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                filter.value === f.value
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Link
                href={`/admin/venues?status=${f.value}`}
                aria-current={filter.value === f.value ? "page" : undefined}
              >
                {f.label}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      {venues.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="Nothing here"
          description="No venues match this filter."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {venues.map((v) => (
            <li
              key={v.id}
              className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card"
            >
              <Link
                href={`/admin/venues/${v.id}`}
                className="motion-trigger flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] p-5 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:p-6"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-lg font-semibold tracking-tight text-ink">
                    {v.name}
                  </p>
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                    {v.owner.email} · {v.barangay ? `${v.barangay}, ` : ""}
                    {v.city}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Updated {dateLabel(v.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <VenueStatusBadge status={v.status} />
                  <ChevronRight
                    className="motion-arrow size-4 text-muted-foreground"
                    data-direction="right"
                    aria-hidden
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
