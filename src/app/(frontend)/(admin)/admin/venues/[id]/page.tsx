import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { Amenities } from "@/components/venue/Amenities";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { channelLabel } from "@/lib/payment";
import { pesos } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { VenueImage } from "@/components/venue/VenueImage";

export const metadata = { title: "Admin · Review venue" };

function minuteLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminVenueReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = await prisma.venue.findUnique({
    where: { id },
    include: {
      owner: { select: { email: true, name: true } },
      courts: { orderBy: { sortOrder: "asc" }, include: { schedules: true } },
      paymentMethods: true,
      verification: true,
    },
  });
  if (!v) notFound();

  const hours = (v.courts.find((c) => c.active)?.schedules ?? [])
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="mx-auto max-w-3xl">
      <Button
        asChild
        variant="ghost"
        className={cn(
          "h-auto p-0",
          "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        )}
      >
        <Link href="/admin/venues">
          <ArrowLeft className="size-4" aria-hidden /> Venues
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="page-title">{v.name}</h1>
          <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
            {v.owner.email} · {v.barangay ? `${v.barangay}, ` : ""}
            {v.city}
          </p>
        </div>
        <VenueStatusBadge status={v.status} />
      </div>

      <div className="mt-7 space-y-5">
        {v.verification?.submittedNote && (
          <Card className="p-5">
            <SectionHeader>Owner&apos;s note</SectionHeader>
            <p className="mt-3 break-words text-sm leading-relaxed text-ink-soft">
              {v.verification.submittedNote}
            </p>
          </Card>
        )}

        {v.photos.length > 0 && (
          <Card className="p-5">
            <SectionHeader>Photos</SectionHeader>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {v.photos.slice(0, 6).map((p, i) => (
                <VenueImage
                  key={i}
                  src={p}
                  alt={`Photo ${i + 1}`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </Card>
        )}

        {v.description && (
          <Card className="p-5">
            <SectionHeader>Description</SectionHeader>
            <p className="mt-3 break-words text-sm leading-relaxed text-ink-soft">
              {v.description}
            </p>
          </Card>
        )}

        {v.amenities.length > 0 && (
          <Card className="p-5">
            <SectionHeader>Amenities</SectionHeader>
            <div className="mt-3">
              <Amenities amenities={v.amenities} />
            </div>
          </Card>
        )}

        <Card className="p-5">
          <SectionHeader>Courts</SectionHeader>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
            {v.courts.map((c) => (
              <li key={c.id}>
                {c.name} — {c.indoor ? "Indoor" : "Outdoor"} ·{" "}
                {pesos(c.priceCents)}/hr {!c.active && "(inactive)"}
              </li>
            ))}
            {v.courts.length === 0 && (
              <li className="text-muted-foreground">No courts.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader>Hours</SectionHeader>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            {hours.length === 0 && (
              <li className="text-muted-foreground">No hours set.</li>
            )}
            {hours.map((s) => (
              <li key={s.id}>
                {DAYS[s.dayOfWeek]} {minuteLabel(s.openMinute)} –{" "}
                {minuteLabel(s.closeMinute)}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader>Payment methods</SectionHeader>
          <ul className="mt-3 space-y-3 break-words text-sm leading-relaxed text-ink-soft">
            {v.paymentMethods.map((m) => (
              <li key={m.id}>
                {channelLabel(m.channel)} · {m.accountName} · {m.accountNumber}
              </li>
            ))}
            {v.paymentMethods.length === 0 && (
              <li className="text-muted-foreground">None.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader>Decision</SectionHeader>
          <div className="mt-3">
            <ReviewActions venueId={v.id} status={v.status} />
          </div>
        </Card>
      </div>
    </div>
  );
}
