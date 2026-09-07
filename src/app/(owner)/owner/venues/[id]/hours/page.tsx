import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { HoursEditor } from "@/components/venue-admin/HoursEditor";

export default async function HoursStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/hours`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  const active = v.courts.filter((c) => c.active);
  // Seed venue-wide hours from the first active court's schedule.
  const initialDays = (active[0]?.schedules ?? []).map((s) => ({
    dayOfWeek: s.dayOfWeek,
    openMinute: s.openMinute,
    closeMinute: s.closeMinute,
  }));

  return (
    <HoursEditor
      venueId={id}
      initialDays={initialDays}
      hasActiveCourts={active.length > 0}
      locked={v.status === "PENDING_REVIEW"}
    />
  );
}
