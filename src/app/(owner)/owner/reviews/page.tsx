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
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Reviews</h1>
      <p className="mt-1 text-sm text-muted">What players say about your venues.</p>

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
          <SectionHeader className="mt-5 mb-2">Player reviews</SectionHeader>
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Stars value={r.rating} />
                      <span className="font-medium text-ink">{r.authorName}</span>
                    </div>
                    <span className="text-xs text-muted">{dateLabel(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-brand-700">{r.venueName}</p>
                  {r.body && <p className="mt-1.5 text-sm text-ink-soft">{r.body}</p>}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
