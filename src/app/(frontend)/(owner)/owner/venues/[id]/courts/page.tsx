import { notFound, redirect } from "next/navigation";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { CourtEditor } from "@/components/venue-admin/CourtEditor";

export default async function CourtsStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getOwnerPageSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/courts`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  return (
    <CourtEditor
      venueId={id}
      locked={v.status === "PENDING_REVIEW"}
      courts={v.courts.map((c) => ({
        id: c.id,
        name: c.name,
        indoor: c.indoor,
        covered: c.covered,
        surface: c.surface,
        capacity: c.capacity,
        priceCents: c.priceCents,
        active: c.active,
      }))}
    />
  );
}
