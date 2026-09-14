import Link from "next/link";
import { Inbox } from "lucide-react";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/ui/states";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { VenueStatus } from "@/generated/prisma";

export const metadata = { title: "Admin · Venues" };

const FILTERS: { value: string; label: string; status?: VenueStatus }[] = [
  { value: "PENDING_REVIEW", label: "Pending review", status: "PENDING_REVIEW" },
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
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Venues</h1>

      {/* Segmented control */}
      <div className="mt-4 inline-flex rounded-xl border border-black/10 bg-white">
        {FILTERS.map((f, i) => (
          <Link
            key={f.value}
            href={`/admin/venues?status=${f.value}`}
            className={cn(
              "px-3.5 py-1.5 text-sm font-medium",
              i === 0 && "rounded-l-xl",
              i === FILTERS.length - 1 && "rounded-r-xl",
              i > 0 && "border-l border-black/10",
              filter.value === f.value
                ? "bg-brand-600 text-white"
                : "text-ink-soft hover:bg-black/5 hover:text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {venues.length === 0 ? (
        <EmptyState icon={<Inbox className="size-7" />} title="Nothing here" description="No venues match this filter." />
      ) : (
        <ul className="mt-5 space-y-3">
          {venues.map((v) => (
            <li key={v.id} className="rounded-2xl border border-black/5 bg-white p-4">
              <Link href={`/admin/venues/${v.id}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{v.name}</p>
                  <p className="text-sm text-muted">
                    {v.owner.email} · {v.barangay ? `${v.barangay}, ` : ""}{v.city}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Updated {dateLabel(v.updatedAt)}</p>
                </div>
                <VenueStatusBadge status={v.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
