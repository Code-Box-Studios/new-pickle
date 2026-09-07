import { redirect } from "next/navigation";

export default async function VenueWizardIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/owner/venues/${id}/details`);
}
