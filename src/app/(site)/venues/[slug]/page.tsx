import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, Star } from "lucide-react";
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
import { dateLabel, isoDate, longDateLabel, parseIsoDate, pesos, weekdayLabel } from "@/lib/format";
import { venueJsonLd } from "@/lib/seo";
import { venueMapUrl } from "@/lib/location/maps";
import { venueRatingSummary, listVenueReviews } from "@/lib/review";
import { Stars } from "@/components/review/Stars";
import { cn } from "@/lib/cn";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function minuteLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

async function loadVenue(slug: string) {
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
  if (!isLive(venue)) return { title: "Venue preview", robots: { index: false, follow: false } };
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
    const canPreview = !!session && (session.id === venue.ownerId || session.role === "ADMIN");
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

  // Next 7 days for the date chips.
  const dayChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    return { iso: isoDate(d), weekday: weekdayLabel(d).slice(0, 3), label: dateLabel(d) };
  });
  const selectedDateLabel = `${weekdayLabel(date).slice(0, 3)}, ${dateLabel(date)}`;

  // Min price for the hero block — same logic VenueCard uses.
  const minPriceCents = venue.courts.reduce<number | null>(
    (min, c) => (min === null ? c.priceCents : Math.min(min, c.priceCents)),
    null,
  );

  return (
    <div className="mx-auto max-w-7xl pb-44 md:pb-28">
      {/* Preview banner */}
      {!live && (
        <div className="mx-4 mb-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900 md:mx-6 lg:mx-8">
          Preview — this venue isn&apos;t live yet. Only you and admins can see this page.
        </div>
      )}
      {live && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(venueJsonLd(venue)) }}
        />
      )}

      {/* Two-column layout: left = venue info, right = booking schedule */}
      <div className="md:flex md:items-start md:gap-0 md:px-6 md:pt-8 lg:px-8 lg:pt-10">

        {/* ── LEFT: venue info ─────────────────────────────────── */}
        <div className="md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:w-[320px] md:shrink-0 md:overflow-y-auto md:border-r md:border-line md:pr-6 md:[scrollbar-width:none] lg:pr-7">
          {/* Gallery — full-bleed on mobile, contained on md+ */}
          <Gallery photos={venue.photos} name={venue.name} />

          {/* Hero */}
          <div className="px-4 pt-6 md:px-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
              <h1 className="w-full break-words text-[28px] font-semibold leading-tight tracking-tight text-ink">
                {venue.name}
              </h1>
              <Badge tone="brand" className="gap-1.5 px-2.5 py-1 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden /> Verified
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1 text-ink-soft">
                <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-semibold text-ink">
                  {ratingSummary.avg.toFixed(1)}
                </span>
                <span>({ratingSummary.count} reviews)</span>
              </span>
              {minPriceCents !== null && (
                <span className="font-medium text-ink-soft">
                  From <span className="text-ink">{pesos(minPriceCents)}</span>/hr
                </span>
              )}
              <span className="flex w-full items-start gap-1.5 break-words leading-6">
                <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
                {venue.barangay ? `${venue.barangay}, ` : ""}
                {venue.city}
              </span>
            </div>
          </div>

          {/* Venue info sections */}
          <div className="px-4 md:px-0">
            <HomeTab venue={venue} hoursByDay={hoursByDay} />
          </div>

          {/* Reviews */}
          {ratingSummary.count > 0 && (
            <div className="px-4 pb-7 md:px-0">
              <h2 className="section-title">Reviews</h2>
              <ReviewsSection ratingSummary={ratingSummary} recentReviews={recentReviews} />
            </div>
          )}
        </div>

        {/* ── RIGHT: booking schedule ───────────────────────────── */}
        <div className="min-w-0 flex-1 border-t border-line pt-7 md:border-t-0 md:pl-6 md:pt-0 lg:pl-7">
          <h2 className="mb-5 px-4 text-2xl font-semibold tracking-tight text-ink md:px-0">
            Book a court
          </h2>
          {/* DateRail — full-bleed on mobile (no outer px) */}
          <div>
            <DateRail
              days={dayChips}
              slug={venue.slug}
              dateStr={dateStr}
              duration={duration}
            />
          </div>

          <div className="px-4 md:px-0">
            {/* Duration pills */}
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Booking duration">
              {DURATIONS.map((dur) => {
                const active = dur.value === duration;
                return (
                  <Link
                    key={dur.value}
                    href={`/venues/${venue.slug}?date=${dateStr}&duration=${dur.value}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                      active
                        ? "border-brand-300 bg-brand-50 text-brand-800"
                        : "border-line bg-surface text-ink-soft hover:border-brand-300 hover:bg-mist",
                    )}
                  >
                    {dur.label}
                  </Link>
                );
              })}
            </div>

            <p className="mt-6 text-sm font-medium text-ink-soft">
              {longDateLabel(parseIsoDate(dateStr))}
            </p>

            <div className="mt-4">
              <CourtBooking
                courts={courts}
                durationMinutes={durationMinutes}
                isAuthed={!!session}
                returnTo={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}`}
                selectedDateLabel={selectedDateLabel}
              />
            </div>
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
    <div className="space-y-6 py-7 [&>section]:border-b [&>section]:border-line [&>section]:pb-6 [&>section:last-child]:border-0 [&>section:last-child]:pb-0">
      {venue.description && (
        <section>
          <h2 className="section-title">About</h2>
          <p className="mt-3 break-words text-sm leading-6 text-ink-soft">{venue.description}</p>
        </section>
      )}
      {venue.amenities.length > 0 && (
        <section>
          <h2 className="section-title">Amenities</h2>
          <div className="mt-3">
            <Amenities amenities={venue.amenities} />
          </div>
        </section>
      )}
      {hoursByDay.size > 0 && (
        <section>
          <h2 className="section-title">Operating hours</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {WEEKDAY_ORDER.map((wd) => {
              const h = hoursByDay.get(wd);
              const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              return (
                <li key={wd} className="flex justify-between gap-3">
                  <span className="text-ink-soft">{names[wd]}</span>
                  <span className="text-right tabular-nums text-muted">
                    {h ? `${minuteLabel(h.open)} – ${minuteLabel(h.close)}` : "Closed"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(venue.contactNumber || venue.website) && (
        <section>
          <h2 className="section-title">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {venue.contactNumber && (
              <li>
                <a href={`tel:${venue.contactNumber}`} className="inline-flex min-h-11 items-center rounded-lg text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
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
        <h2 className="section-title">Location</h2>
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
          <h2 className="section-title">House rules</h2>
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-ink-soft">{venue.houseRules}</p>
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
  ratingSummary: { avg: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
  recentReviews: Array<{ id: string; rating: number; authorName: string; createdAt: Date; body: string | null }>;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight text-ink">{ratingSummary.avg.toFixed(1)}</span>
          <Stars value={ratingSummary.avg} />
          <span className="text-sm text-muted">{ratingSummary.count} reviews</span>
        </div>
        <ul className="min-w-[10rem] flex-1 space-y-1.5" aria-label="Rating distribution">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = ratingSummary.distribution[n as 1 | 2 | 3 | 4 | 5];
            const pct = ratingSummary.count ? Math.round((c / ratingSummary.count) * 100) : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs text-muted" aria-label={`${n} stars: ${c} reviews`}>
                <span className="w-3 text-right">{n}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
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
                <span className="text-xs text-muted">{dateLabel(r.createdAt)}</span>
              </div>
              {r.body && <p className="mt-3 break-words text-sm leading-6 text-ink-soft">{r.body}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
