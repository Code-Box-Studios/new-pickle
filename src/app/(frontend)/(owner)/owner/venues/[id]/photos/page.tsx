import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { PhotoManager } from "@/components/venue-admin/PhotoManager";

export default async function PhotosStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/photos`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  return <PhotoManager venueId={id} initial={v.photos} locked={v.status === "PENDING_REVIEW"} />;
}
