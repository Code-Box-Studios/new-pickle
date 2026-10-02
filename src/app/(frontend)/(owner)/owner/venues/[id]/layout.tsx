import { Card } from "@/components/ui/card";
import { notFound, redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { loadOwnerVenue, wizardProgress } from "@/lib/venue/owner-load";
import { StepRail } from "@/components/venue-admin/StepRail";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";

export default async function WizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/details`);
  const venue = await loadOwnerVenue(id, session.id, session.role);
  if (!venue) notFound();

  const done = wizardProgress(venue);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title min-w-0 break-words">{venue.name}</h1>
        <VenueStatusBadge status={venue.status} />
      </div>

      {venue.status === "PENDING_REVIEW" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          <Clock className="size-4 shrink-0" aria-hidden />
          This venue is under review. You&apos;ll be notified once it&apos;s
          approved — editing is paused until then.
        </div>
      )}

      <div className="mt-6">
        <StepRail venueId={id} done={done} />
      </div>

      <Card className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-7">
        {children}
      </Card>
    </div>
  );
}
