import { notFound, redirect } from "next/navigation";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { venueCompleteness } from "@/lib/venue/completeness";
import { ReviewSubmit } from "@/components/venue-admin/ReviewSubmit";

export default async function ReviewStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getOwnerPageSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/review`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  const { missing } = venueCompleteness({
    name: v.name,
    city: v.city,
    photos: v.photos,
    courts: v.courts,
    paymentMethods: v.paymentMethods,
  });

  return (
    <ReviewSubmit
      venueId={id}
      status={v.status}
      missing={missing}
      submittedNote={v.verification?.submittedNote ?? null}
      rejectionReason={v.verification?.notes ?? null}
    />
  );
}
