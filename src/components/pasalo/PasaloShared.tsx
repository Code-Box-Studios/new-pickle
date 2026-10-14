import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { longDateLabel, timeLabel } from "@/lib/format";
import type { ListingStatus, PasaloListingView, TradeStatus } from "@/lib/pasalo/types";

export function pasaloPrice(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const statusLabels: Record<ListingStatus | TradeStatus, string> = {
  ACTIVE: "Available", RESERVED: "Reserved", SOLD: "Transferred", WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired", VOIDED: "No longer available", PAYMENT_SENT: "Payment sent",
  TRANSFERRED: "Transferred", RELEASED: "Released",
};

export function PasaloStatus({ status }: { status: ListingStatus | TradeStatus }) {
  return <Badge tone={status === "ACTIVE" || status === "SOLD" || status === "TRANSFERRED" ? "brand" : status === "RESERVED" || status === "PAYMENT_SENT" ? "amber" : "neutral"}>{statusLabels[status]}</Badge>;
}

export function PasaloShell({ title, description, back, actions, children }: {
  title: string; description?: string; back?: { href: string; label: string }; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="page-shell min-w-0 py-8 sm:py-12">
      <div className="mx-auto min-w-0 max-w-5xl">
        {back && <Link href={back.href} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="size-4" aria-hidden />{back.label}</Link>}
        <div className="mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0"><h1 className="page-title mb-2">{title}</h1>{description && <p className="max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{description}</p>}</div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PasaloRiskDisclosure() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm leading-relaxed text-ink-soft">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
      <p><strong className="font-semibold text-ink">Pay the seller directly.</strong> Pikol cannot automatically verify or refund direct payments. Only the seller’s wallet receipt confirmation transfers the booking.</p>
    </div>
  );
}

export function PasaloError({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="min-w-0 break-words">{message}</p>{retry && <Button variant="outline" size="sm" onClick={retry}>Try again</Button>}</div>;
}

export function PasaloEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card className="items-center rounded-2xl border-dashed bg-white px-5 py-12 text-center"><CalendarDays className="mb-4 size-8 text-brand-700" aria-hidden /><h2 className="text-lg font-semibold text-ink">{title}</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>{action && <div className="mt-5">{action}</div>}</Card>;
}

export function PasaloBookingFacts({ listing }: { listing: PasaloListingView }) {
  const startsAt = new Date(listing.startsAt);
  const endsAt = new Date(listing.endsAt);
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  const duration = minutes % 60 === 0 ? `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}` : `${minutes} minutes`;
  return (
    <dl className="space-y-3 text-sm text-ink-soft">
      <div className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /><div><dt className="sr-only">Venue and court</dt><dd className="font-semibold text-ink">{listing.venueName} · {listing.courtName}</dd><dd className="mt-0.5">{listing.city}</dd></div></div>
      <div className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /><div><dt className="sr-only">Booking date</dt><dd>{longDateLabel(startsAt)}</dd></div></div>
      <div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /><div><dt className="sr-only">Booking time and duration</dt><dd>{timeLabel(startsAt)} – {timeLabel(endsAt)}</dd><dd className="mt-0.5">{duration} · Philippine time</dd></div></div>
    </dl>
  );
}

export function PasaloPriceSummary({ listing }: { listing: PasaloListingView }) {
  const discount = Math.round((1 - listing.priceCents / listing.originalPriceCents) * 100);
  return <div className="rounded-xl bg-secondary/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-ink-soft">Transfer price</span><Badge tone="brand">Save {pasaloPrice(listing.originalPriceCents - listing.priceCents)}{discount > 0 ? ` · ${discount}%` : ""}</Badge></div><p className="mt-2 text-3xl font-semibold tracking-tight text-brand-700">{pasaloPrice(listing.priceCents)}</p><p className="mt-1 text-sm text-ink-soft">Original paid price <span className="line-through">{pasaloPrice(listing.originalPriceCents)}</span></p></div>;
}

export function PasaloListingCard({ listing, children }: { listing: PasaloListingView; children?: ReactNode }) {
  return <Card className="min-w-0 gap-5 rounded-2xl bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><PasaloStatus status={listing.status} /><span className="text-xs font-semibold uppercase tracking-wider text-brand-700">Pasalo</span></div><PasaloBookingFacts listing={listing} /><PasaloPriceSummary listing={listing} />{children ?? <Button asChild variant="outline" className="w-full"><Link href={`/pasalo/${listing.id}`}>View offer<ArrowUpRight className="size-4" aria-hidden /></Link></Button>}</Card>;
}
