import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { PublishControls } from "@/components/venue-admin/PublishControls";
import { CreateVenueButton } from "@/components/venue-admin/CreateVenueButton";

export const metadata = { title: "My venues" };

export default async function OwnerVenuesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/owner/venues");

  const ids = await accessibleVenueIds(session.id, session.role);
  const venues = await prisma.venue.findMany({
    where: { id: { in: ids } },
    include: { verification: true, _count: { select: { courts: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">My venues</h1>
        {venues.length > 0 && <CreateVenueButton label="List another venue" />}
      </div>

      {venues.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-7" />}
          title="No venues yet"
          description="List your first venue to start taking reservations."
          action={{ label: "Create your venue", href: "/list-your-venue" }}
        />
      ) : (
        <ul className="mt-6 space-y-4">
          {venues.map((v) => {
            const live = v.isPublished && v.status === "APPROVED";
            return (
              <li
                key={v.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-tight text-ink">
                        {v.name}
                      </p>
                      <VenueStatusBadge status={v.status} />
                      {v.status === "APPROVED" && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {live ? "· Live" : "· Not published"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {v.barangay ? `${v.barangay}, ` : ""}
                      {v.city} · {v._count.courts} court
                      {v._count.courts === 1 ? "" : "s"}
                    </p>
                    {v.status === "REJECTED" && v.verification?.notes && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        Reviewer: {v.verification.notes}
                      </p>
                    )}
                    {v.status === "SUSPENDED" && v.verification?.notes && (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        Suspended: {v.verification.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(v.status === "DRAFT" || v.status === "REJECTED") && (
                      <Link
                        href={`/owner/venues/${v.id}/details`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Continue setup
                      </Link>
                    )}
                    {v.status === "PENDING_REVIEW" && (
                      <Link
                        href={`/owner/venues/${v.id}/details`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        View
                      </Link>
                    )}
                    {v.status === "APPROVED" && (
                      <>
                        <Link
                          href={`/venues/${v.slug}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Preview
                        </Link>
                        <Link
                          href={`/owner/venues/${v.id}/details`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          Edit
                        </Link>
                        <PublishControls
                          venueId={v.id}
                          isPublished={v.isPublished}
                        />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
