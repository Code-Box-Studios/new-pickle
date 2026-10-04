import { notFound, redirect } from "next/navigation";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { CourtEditor } from "@/components/venue-admin/CourtEditor";
import { normalizeCourtTimeRates } from "@/lib/court-pricing";
import prisma from "@/lib/prisma";

export default async function CourtsStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getOwnerPageSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/courts`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();
  const connection = await prisma.sentryConnection.findUnique({
    where: { venueId: id },
    select: { connectionState: true },
  });

  return (
    <CourtEditor
      venueId={id}
      locked={v.status === "PENDING_REVIEW"}
      pricingLocked={connection?.connectionState === "CONNECTED"}
      courts={v.courts.map((c) => ({
        id: c.id,
        name: c.name,
        indoor: c.indoor,
        covered: c.covered,
        surface: c.surface,
        capacity: c.capacity,
        priceCents: c.priceCents,
        timeRates:
          connection?.connectionState === "CONNECTED"
            ? []
            : normalizeCourtTimeRates(c.timeRates),
        active: c.active,
      }))}
    />
  );
}
