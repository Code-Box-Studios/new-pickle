import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBookingByReference } from "@/lib/bookings-read";
import { nowMs } from "@/lib/now";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { DetailsForm } from "@/components/booking/DetailsForm";
import { PaymentStep } from "@/components/booking/PaymentStep";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Complete your booking" };

export default async function BookPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/book/${reference}`);

  const b = await getBookingByReference(reference, session.id, session.role);
  if (!b) notFound();

  // Already past the pay step → the permanent status page owns it.
  if (
    ["PAYMENT_SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED", "COMPLETED", "REJECTED"].includes(
      b.status,
    )
  ) {
    redirect(`/bookings/${reference}`);
  }

  const expired =
    !!b.holdExpiresAt && b.holdExpiresAt.getTime() < nowMs();
  const dead = b.status === "EXPIRED" || b.status === "CANCELLED" || expired;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <p className="text-sm text-muted">
        Booking <span className="font-semibold text-ink">{b.reference}</span>
      </p>

      <div className="mt-3">
        <BookingSummary
          venueName={b.venue.name}
          courtName={b.court.name}
          startsAt={b.startsAt}
          endsAt={b.endsAt}
          priceCents={b.priceCents}
        />
      </div>

      <div className="mt-6">
        {dead ? (
          <Card className="p-5 text-center">
            <h2 className="text-lg font-bold text-ink">Your hold expired</h2>
            <p className="mt-1 text-muted">
              This slot was released. Pick another time — it only takes a moment.
            </p>
            <Link href={`/venues/${b.venue.slug}`} className="mt-4 inline-block">
              <Button size="lg">Find another court</Button>
            </Link>
          </Card>
        ) : b.status === "HELD" ? (
          <DetailsForm
            bookingId={b.id}
            expiresAt={b.holdExpiresAt!.toISOString()}
            defaultName={b.customerName ?? ""}
            defaultMobile={b.customerMobile ?? ""}
            defaultEmail={b.customerEmail ?? session.email}
          />
        ) : (
          <PaymentStep
            bookingId={b.id}
            reference={b.reference}
            expiresAt={b.holdExpiresAt!.toISOString()}
            amountCents={b.priceCents}
            venueName={b.venue.name}
            methods={b.venue.paymentMethods.map((m) => ({
              id: m.id,
              channel: m.channel,
              accountName: m.accountName,
              accountNumber: m.accountNumber,
              instructions: m.instructions,
            }))}
          />
        )}
      </div>
    </div>
  );
}
