import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBookingByReference } from "@/lib/bookings-read";
import { nowMs } from "@/lib/now";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { DetailsForm } from "@/components/booking/DetailsForm";
import { PaymentStep } from "@/components/booking/PaymentStep";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PayMongoPayment } from "@/components/booking/PayMongoPayment";
import {
  checkoutForBooking,
  publicCheckoutStatus,
} from "@/lib/payments/paymongo/checkout";
import {
  merchantForVenue,
  type Merchant,
} from "@/lib/payments/paymongo/config";

export const metadata = { title: "Complete your booking" };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { reference } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/book/${reference}`);

  const b = await getBookingByReference(reference, session.id, session.role);
  if (!b) notFound();
  const query = await searchParams;
  const checkout = await checkoutForBooking(b.id);
  let merchant: Merchant | null = null;
  try {
    merchant = merchantForVenue(b.venueId, b.venue.ownerId);
  } catch {
    /* Manual payments remain usable if creation is misconfigured. */
  }
  const activeCheckout =
    checkout && !["FAILED", "EXPIRED"].includes(checkout.status);
  const hosted =
    activeCheckout || (!checkout && merchant && query.payment !== "manual");

  // Already past the pay step → the permanent status page owns it.
  if (
    [
      "PAYMENT_SUBMITTED",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "COMPLETED",
      "REJECTED",
    ].includes(b.status)
  ) {
    redirect(`/bookings/${reference}`);
  }

  const expired = !!b.holdExpiresAt && b.holdExpiresAt.getTime() < nowMs();
  const dead = b.status === "EXPIRED" || b.status === "CANCELLED" || expired;

  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow break-words">
          Booking <span className="font-semibold text-ink">{b.reference}</span>
        </p>
        <h1 className="page-title mt-3">Complete your booking</h1>

        <div className="mt-7 sm:mt-8">
          <BookingSummary
            venueName={b.venue.name}
            courtName={b.court.name}
            startsAt={b.startsAt}
            endsAt={b.endsAt}
            priceCents={b.priceCents}
          />
        </div>

        <div className="mt-5 sm:mt-6">
          {dead ? (
            <Card className="p-6 text-center sm:p-7">
              <h2 className="section-title">Your hold expired</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                This slot was released. Pick another time — it only takes a
                moment.
              </p>
              {checkout && (
                <Link
                  href={`/bookings/${reference}`}
                  className={`${buttonVariants({ variant: "outline", size: "lg" })} mt-5 w-full`}
                >
                  Check payment status before paying again
                </Link>
              )}
              <Link
                href={`/venues/${b.venue.slug}`}
                className={`${buttonVariants({ size: "lg" })} mt-5`}
              >
                Find another court
              </Link>
            </Card>
          ) : b.status === "HELD" ? (
            <Card className="p-6 sm:p-7">
              <DetailsForm
                bookingId={b.id}
                expiresAt={b.holdExpiresAt!.toISOString()}
                defaultName={b.customerName ?? ""}
                defaultMobile={b.customerMobile ?? session.mobile ?? ""}
                defaultEmail={b.customerEmail ?? session.email ?? ""}
              />
            </Card>
          ) : (
            <Card className="p-6 sm:p-7">
              {hosted ? (
                <PayMongoPayment
                  bookingId={b.id}
                  reference={b.reference}
                  expiresAt={b.holdExpiresAt!.toISOString()}
                  amountCents={b.priceCents}
                  venueName={b.venue.name}
                  methods={merchant?.methods ?? []}
                  testMode={(checkout?.mode ?? merchant?.mode) === "test"}
                  checkoutEnabled={!!merchant}
                  initial={publicCheckoutStatus(checkout)}
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
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
