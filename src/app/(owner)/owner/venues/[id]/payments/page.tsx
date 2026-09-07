import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadOwnerVenue } from "@/lib/venue/owner-load";
import { PaymentMethodEditor } from "@/components/venue-admin/PaymentMethodEditor";

export default async function PaymentsStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/owner/venues/${id}/payments`);
  const v = await loadOwnerVenue(id, session.id, session.role);
  if (!v) notFound();

  return (
    <PaymentMethodEditor
      venueId={id}
      locked={v.status === "PENDING_REVIEW"}
      methods={v.paymentMethods.map((m) => ({
        id: m.id,
        channel: m.channel,
        accountName: m.accountName,
        accountNumber: m.accountNumber,
        instructions: m.instructions,
        active: m.active,
      }))}
    />
  );
}
