import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { loadOwnerVenue, wizardProgress } from "@/lib/venue/owner-load";
import { StepRail } from "@/components/venue-admin/StepRail";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { SetupStepPanel } from "@/components/venue-admin/SetupStepPanel";

export default async function WizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getOwnerPageSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/details`);
  const venue = await loadOwnerVenue(id, session.id, session.role);
  if (!venue) notFound();

  const done = wizardProgress(venue);

  return (
    <div className="-mt-2 mx-auto max-w-6xl lg:mt-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/owner/venues"
          className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="size-4" aria-hidden /> My venues
        </Link>
        <span className="lg:hidden">
          <VenueStatusBadge status={venue.status} />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4 lg:mt-3">
        <div className="min-w-0">
          <h1 className="page-title text-2xl lg:text-4xl">Set up your venue</h1>
          <p className="mt-1 break-words text-sm text-muted-foreground lg:mt-2">
            {venue.name}{" "}
            <span className="hidden lg:inline">
              <span className="mx-1 text-line" aria-hidden>
                {" "}
                /{" "}
              </span>{" "}
              A new home for the game.
            </span>
          </p>
        </div>
        <div className="hidden items-center gap-3 pt-1 lg:flex">
          <VenueStatusBadge status={venue.status} />
          {venue.status === "DRAFT" && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <ShieldCheck className="size-3.5" aria-hidden /> Only visible to
              your team
            </span>
          )}
        </div>
      </div>

      {venue.status === "PENDING_REVIEW" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          <Clock className="size-4 shrink-0" aria-hidden />
          This venue is under review. You&apos;ll be notified once it&apos;s
          approved — editing is paused until then.
        </div>
      )}

      <div className="mt-4 lg:mt-6">
        <StepRail venueId={id} done={done} />
      </div>

      <SetupStepPanel>{children}</SetupStepPanel>
    </div>
  );
}
