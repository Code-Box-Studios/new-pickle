import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { accessibleVenueIds } from "@/lib/api/owner-access";
import { listReviewsForVenues } from "@/lib/review";
import { Stars } from "@/components/review/Stars";
import { EmptyState } from "@/components/ui/states";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { dateLabel } from "@/lib/format";

export const metadata = { title: "Reviews" };

export default async function OwnerReviewsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/owner/reviews");

  const ids = await accessibleVenueIds(session.id, session.role);
  const reviews = await listReviewsForVenues(ids, 100);

  return (
    <div>
      <h1 className="page-title">Reviews</h1>
      <p className="page-description mt-3">
        What players say about your venues.
      </p>

      {reviews.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Star className="size-7" />}
            title="No reviews yet"
            description="Reviews appear here after players complete a booking and rate their visit."
          />
        </div>
      ) : (
        <>
          <SectionHeader className="mt-8 mb-4">Player reviews</SectionHeader>
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
                      <Stars value={r.rating} />
                      <span className="font-medium text-ink">
                        {r.authorName}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dateLabel(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-brand-700">
                    {r.venueName}
                  </p>
                  {r.body && (
                    <p className="mt-3 break-words text-sm leading-relaxed text-ink-soft">
                      {r.body}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
