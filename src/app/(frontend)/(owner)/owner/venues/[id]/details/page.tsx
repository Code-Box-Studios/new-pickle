import { notFound, redirect } from "next/navigation";
import { getOwnerPageSession } from "@/lib/auth/owner-page";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { DetailsForm } from "@/components/venue-admin/DetailsForm";

export default async function DetailsStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getOwnerPageSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/details`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  return (
    <DetailsForm
      venueId={id}
      coverPhoto={v.photos[0]}
      locked={v.status === "PENDING_REVIEW"}
      initial={{
        name: v.name,
        description: v.description,
        addressLine: v.addressLine,
        barangay: v.barangay,
        city: v.city,
        contactNumber: v.contactNumber,
        website: v.website,
        mapUrl: v.mapUrl,
        houseRules: v.houseRules,
        amenities: v.amenities,
      }}
    />
  );
}
