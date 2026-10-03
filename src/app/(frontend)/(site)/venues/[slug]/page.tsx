import { Button } from "@/components/ui/button";
import { PaddleIcon } from "@/components/ui/pickleball";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { venueAvailability } from "@/lib/availability/engine";
import { Gallery } from "@/components/venue/Gallery";
import { Amenities } from "@/components/venue/Amenities";
import { CourtBooking, type CourtDTO } from "@/components/court/CourtBooking";
import { DateRail } from "@/components/court/DateRail";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DURATIONS } from "@/lib/search-params";
import {
  dateLabel,
  isoDate,
  longDateLabel,
  parseIsoDate,
  pesos,
  weekdayLabel,
} from "@/lib/format";
import { venueJsonLd } from "@/lib/seo";
import { venueMapUrl } from "@/lib/location/maps";
import { venueRatingSummary, listVenueReviews } from "@/lib/review";
import { Stars } from "@/components/review/Stars";
import { cn } from "@/lib/cn";
import { isPreviewMode } from "@/lib/deployment";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function minuteLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

async function loadVenue(slug: string) {
  if (isPreviewMode()) return null;
  // Load regardless of publish state; the caller gates who may view a
  // non-live venue (owner/admin preview only).
  return prisma.venue.findFirst({
    where: { slug },
    include: {
      courts: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { schedules: true },
      },
    },
  });
}

function isLive(v: { isPublished: boolean; status: string }): boolean {
  return v.isPublished && v.status === "APPROVED";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadVenue(slug);
  if (!venue) return { title: "Venue not found" };
  const desc =
    venue.description ??
    `Book a pickleball court at ${venue.name} in ${venue.city}.`;
  // Don't leak an unpublished venue's name or let it get indexed.
  if (!isLive(venue))
    return { title: "Venue preview", robots: { index: false, follow: false } };
  return {
    title: venue.name,
    description: desc,
    alternates: { canonical: `/venues/${venue.slug}` },
    openGraph: { title: venue.name, description: desc, images: venue.photos },
  };
}

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; duration?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const venue = await loadVenue(slug);
  if (!venue) notFound();

  const session = await getSession();
  const live = isLive(venue);
  if (!live) {
    const canPreview =
      !!session && (session.id === venue.ownerId || session.role === "ADMIN");
    if (!canPreview) notFound();
  }

  const [ratingSummary, recentReviews] = await Promise.all([
    venueRatingSummary(venue.id),
    listVenueReviews(venue.id, 6),
  ]);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = sp.date ?? isoDate(tomorrow);
  const date = parseIsoDate(dateStr);
  const duration = sp.duration ?? "60";
  const durationMinutes = Number(duration) || 60;

  const avail = await venueAvailability(venue.id, date, { durationMinutes });
  const availByCourt = new Map(avail.map((a) => [a.courtId, a.slots]));

  const courts: CourtDTO[] = venue.courts.map((c) => ({
    id: c.id,
    name: c.name,
    indoor: c.indoor,
    covered: c.covered,
    surface: c.surface,
    priceCents: c.priceCents,
    slots: (availByCourt.get(c.id) ?? []).map((s) => ({
      startsAt: s.startsAt.toISOString(),
      available: s.available,
      priceCents: s.priceCents,
    })),
  }));

  // Weekly hours (min open / max close per weekday across courts).
  const hoursByDay = new Map<number, { open: number; close: number }>();
  for (const c of venue.courts) {
    for (const s of c.schedules) {
      const cur = hoursByDay.get(s.dayOfWeek);
      hoursByDay.set(s.dayOfWeek, {
        open: cur ? Math.min(cur.open, s.openMinute) : s.openMinute,
        close: cur ? Math.max(cur.close, s.closeMinute) : s.closeMinute,
      });
    }
  }

  // Keep later calendar selections visible in the seven-day rail.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const railStart = new Date(today);
  if (date.getTime() > today.getTime() + 6 * 86_400_000) {
    railStart.setTime(date.getTime() - 3 * 86_400_000);
  }
  const dayChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(railStart);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      iso: isoDate(d),
      weekday: weekdayLabel(d).slice(0, 3),
      label: dateLabel(d),
    };
  });
  const selectedDateLabel = `${weekdayLabel(date).slice(0, 3)}, ${dateLabel(date)}`;

  // Min price for the hero block — same logic VenueCard uses.
  const minPriceCents = venue.courts.reduce<number | null>(
    (min, c) => (min === null ? c.priceCents : Math.min(min, c.priceCents)),
    null,
  );

  return (
    <div className="bg-surface-soft pb-56 pt-3 md:pb-36">
      <div className="page-shell">
        <Button
          asChild
          variant="ghost"
          className="mb-4 gap-2 px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-brand-700"
        >
          <Link
            href={`/search?city=${encodeURIComponent(venue.city)}&date=${dateStr}&duration=${duration}`}
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to courts
          </Link>
        </Button>
        {!live && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            Preview — this venue isn&apos;t live yet. Only you and admins can
            see this page.
          </div>
        )}
        {live && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(venueJsonLd(venue)),
            }}
          />
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-8">
          <Card className="min-w-0 overflow-hidden p-4 lg:col-start-1 lg:row-start-1">
            <Gallery photos={venue.photos} name={venue.name} />
            <div className="px-1 pb-1 pt-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="brand" className="gap-1.5 px-2.5 py-1 text-xs">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {live ? "Verified venue" : "Venue preview"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {courts.length} {courts.length === 1 ? "court" : "courts"}
                </span>
              </div>
              <h1 className="break-words text-[28px] font-medium leading-tight tracking-tight text-ink">
                {venue.name}
              </h1>
              <p className="mt-3 flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {venue.barangay ? `${venue.barangay}, ` : ""}
                {venue.city}
              </p>
              <a
                href="#venue-reviews"
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-ink-soft"
              >
                <Star
                  className="size-4 fill-brand-700 text-brand-700"
                  aria-hidden
                />
                <span className="font-semibold text-ink">
                  {ratingSummary.count
                    ? ratingSummary.avg.toFixed(1)
                    : "New venue"}
                </span>
                {ratingSummary.count > 0 && (
                  <span className="text-muted-foreground">
                    · {ratingSummary.count} reviews
                  </span>
                )}
              </a>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Court rates from
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                    {minPriceCents === null
                      ? "Coming soon"
                      : pesos(minPriceCents)}
                    {minPriceCents !== null && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / hour
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label="Get directions"
                >
                  <a
                    href={venueMapUrl(venue)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="size-4" aria-hidden />
                  </a>
                </Button>
              </div>
              <Button asChild className="mt-5 w-full gap-2 lg:hidden">
                <a href="#book-court">
                  See available times{" "}
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>
            </div>
          </Card>

          <Card
            id="book-court"
            className="min-w-0 scroll-mt-28 p-4 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          >
            <div className="mb-4 flex items-start gap-3 border-b border-border pb-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-brand-700">
                <PaddleIcon className="size-6" />
              </span>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-ink sm:text-[28px]">
                  Book your next game
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  A day, a court, a time. You&apos;re almost playing.
                </p>
              </div>
            </div>
            <DateRail
              days={dayChips}
              slug={venue.slug}
              dateStr={dateStr}
              duration={duration}
              minDate={isoDate(today)}
            />
            <div className="my-4 border-y border-border py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs text-brand-700">
                    2
                  </span>{" "}
                  Session length
                </p>
                <Clock3 className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Booking duration"
              >
                {DURATIONS.map((dur) => {
                  const active = dur.value === duration;
                  return (
                    <Button
                      key={dur.value}
                      asChild
                      variant={active ? "secondary" : "outline"}
                      className={cn(
                        "gap-1 px-2 text-sm",
                        active &&
                          "border-brand-700/40 bg-secondary text-brand-700 ring-1 ring-brand-700/10",
                      )}
                    >
                      <Link
                        href={`/venues/${venue.slug}?date=${dateStr}&duration=${dur.value}`}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                      >
                        {dur.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {longDateLabel(date)} · {Number(duration) / 60}{" "}
                {duration === "60" ? "hour" : "hours"} of court time
              </p>
            </div>
            <CourtBooking
              key={`${dateStr}:${duration}`}
              courts={courts}
              durationMinutes={durationMinutes}
              isAuthed={!!session}
              returnTo={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}`}
              selectedDateLabel={selectedDateLabel}
            />
          </Card>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
            <Card className="p-5">
              <HomeTab venue={venue} hoursByDay={hoursByDay} />
            </Card>
            <Card id="venue-reviews" className="scroll-mt-28 p-5">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                Player reviews
              </h2>
              {ratingSummary.count > 0 ? (
                <ReviewsSection
                  ratingSummary={ratingSummary}
                  recentReviews={recentReviews}
                />
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  No reviews yet. Play here and share your experience.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Private sub-components ──────────────────────────────────────────────────

// HomeTab — About, Amenities, Hours, Contact, Location, House rules
function HomeTab({
  venue,
  hoursByDay,
}: {
  venue: {
    name: string;
    description: string | null;
    amenities: string[];
    houseRules: string | null;
    addressLine: string | null;
    barangay: string | null;
    city: string;
    contactNumber: string | null;
    website: string | null;
    mapUrl: string | null;
    lat: number | null;
    lng: number | null;
  };
  hoursByDay: Map<number, { open: number; close: number }>;
}) {
  const mapUrl = venueMapUrl(venue);
  return (
    <div className="space-y-6 [&>section]:border-b [&>section]:border-line [&>section]:pb-6 [&>section:last-child]:border-0 [&>section:last-child]:pb-0">
      {venue.description && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            About
          </h2>
          <p className="mt-3 break-words text-sm leading-6 text-ink-soft">
            {venue.description}
          </p>
        </section>
      )}
      {venue.amenities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Amenities
          </h2>
          <div className="mt-3">
            <Amenities amenities={venue.amenities} />
          </div>
        </section>
      )}
      {hoursByDay.size > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Operating hours
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {WEEKDAY_ORDER.map((wd) => {
              const h = hoursByDay.get(wd);
              const names = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ];
              return (
                <li key={wd} className="flex justify-between gap-3">
                  <span className="text-ink-soft">{names[wd]}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {h
                      ? `${minuteLabel(h.open)} – ${minuteLabel(h.close)}`
                      : "Closed"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(venue.contactNumber || venue.website) && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Contact
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {venue.contactNumber && (
              <li>
                <a
                  href={`tel:${venue.contactNumber}`}
                  className="inline-flex min-h-11 items-center rounded-lg text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  {venue.contactNumber}
                </a>
              </li>
            )}
            {venue.website && (
              <li>
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center break-all rounded-lg text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  {venue.website}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Location
        </h2>
        <p className="mt-3 break-words text-sm leading-6 text-ink-soft">
          {venue.addressLine ? `${venue.addressLine}, ` : ""}
          {venue.barangay ? `${venue.barangay}, ` : ""}
          {venue.city}
        </p>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <MapPin className="size-4" aria-hidden /> View on Google Maps
        </a>
      </section>
      {venue.houseRules && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            House rules
          </h2>
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-ink-soft">
            {venue.houseRules}
          </p>
        </section>
      )}
    </div>
  );
}

// ReviewsSection — rating summary + distribution bars + review cards
function ReviewsSection({
  ratingSummary,
  recentReviews,
}: {
  ratingSummary: {
    avg: number;
    count: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  recentReviews: Array<{
    id: string;
    rating: number;
    authorName: string;
    createdAt: Date;
    body: string | null;
  }>;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-medium tracking-tight text-ink">
            {ratingSummary.avg.toFixed(1)}
          </span>
          <Stars value={ratingSummary.avg} />
          <span className="text-sm text-muted-foreground">
            {ratingSummary.count} reviews
          </span>
        </div>
        <ul
          className="min-w-[10rem] flex-1 space-y-1.5"
          aria-label="Rating distribution"
        >
          {[5, 4, 3, 2, 1].map((n) => {
            const c = ratingSummary.distribution[n as 1 | 2 | 3 | 4 | 5];
            const pct = ratingSummary.count
              ? Math.round((c / ratingSummary.count) * 100)
              : 0;
            return (
              <li
                key={n}
                className="flex items-center gap-2 text-xs text-muted-foreground"
                aria-label={`${n} stars: ${c} reviews`}
              >
                <span className="w-3 text-right">{n}</span>
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-5 text-right">{c}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="mt-5 space-y-3">
        {recentReviews.map((r) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="font-medium text-ink">{r.authorName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {dateLabel(r.createdAt)}
                </span>
              </div>
              {r.body && (
                <p className="mt-3 break-words text-sm leading-6 text-ink-soft">
                  {r.body}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
