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
import { DateRail, type DayChip } from "@/components/court/DateRail";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{ date?: string; duration?: string; tab?: string }>;
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

  // Next 7 days for the date chips (precomputed for the client rail).
  const dayChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    return { iso: isoDate(d), weekday: weekdayLabel(d).slice(0, 3), label: dateLabel(d) };
  });
  const selectedDateLabel = `${weekdayLabel(date).slice(0, 3)}, ${dateLabel(date)}`;

  // Tab resolution: if date/duration present without tab, default to book.
  const tab = sp.tab ?? (sp.date || sp.duration ? "book" : "home");

  // Min price for the hero block — same logic VenueCard uses.
  const minPriceCents = venue.courts.reduce<number | null>(
    (min, c) => (min === null ? c.priceCents : Math.min(min, c.priceCents)),
    null,
  );

  const venueTabs = [
    {
      label: "Home",
      value: "home",
      href: `/venues/${venue.slug}?tab=home`,
    },
    {
      label: "Book",
      value: "book",
      href: `/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`,
    },
    {
      label: "Reviews",
      value: "reviews",
      href: `/venues/${venue.slug}?tab=reviews`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-24 md:pb-12">
      {/* Preview banner — unchanged, full-width above gallery */}
      {!live && (
        <div className="mx-5 mt-4 mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
          Preview — this venue isn&apos;t live yet. Only you and admins can see this page.
        </div>
      )}
      {live && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(venueJsonLd(venue)) }}
        />
      )}

      {/* Gallery — full-bleed mobile, contained sm+ (unchanged from committed pass) */}
      <div className="-mx-5 sm:mx-0 sm:mt-6">
        <Gallery photos={venue.photos} name={venue.name} />
      </div>

      {/* Hero title block */}
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                {venue.name}
              </h1>
              <Badge tone="brand" className="gap-1 px-2 py-0.5 text-[11px]">
                <ShieldCheck className="size-3" aria-hidden /> Verified
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
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
              <span className="flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {venue.barangay ? `${venue.barangay}, ` : ""}
                {venue.city}
              </span>
            </div>
          </div>
          <Link
            href={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`}
            className="shrink-0"
          >
            <Button size="sm">Book a court</Button>
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-5 px-5">
        <Tabs tabs={venueTabs} activeValue={tab} />
      </div>

      {/* Tab content */}
      <div className="px-5">
        {tab === "home" && (
          <HomeTab venue={venue} hoursByDay={hoursByDay} />
        )}
        {tab === "book" && (
          <BookTab
            venue={venue}
            courts={courts}
            durationMinutes={durationMinutes}
            duration={duration}
            dateStr={dateStr}
            dayChips={dayChips}
            selectedDateLabel={selectedDateLabel}
            isAuthed={!!session}
          />
        )}
        {tab === "reviews" && (
          <ReviewsTab ratingSummary={ratingSummary} recentReviews={recentReviews} />
        )}
      </div>
    </div>
  );
}

// ─── Private sub-components ──────────────────────────────────────────────────

// HomeTab — renders About, Amenities, Hours, Contact, Location, House rules
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
    <div className="space-y-8 py-6">
      {venue.description && (
        <section>
          <h2 className="text-lg font-bold text-ink">About</h2>
          <p className="mt-2 text-ink-soft">{venue.description}</p>
        </section>
      )}
      {venue.amenities.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink">Amenities</h2>
          <div className="mt-3">
            <Amenities amenities={venue.amenities} />
          </div>
        </section>
      )}
      {hoursByDay.size > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink">Operating hours</h2>
          <ul className="mt-3 max-w-sm space-y-1 text-sm">
            {WEEKDAY_ORDER.map((wd) => {
              const h = hoursByDay.get(wd);
              const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              return (
                <li key={wd} className="flex justify-between">
                  <span className="text-ink-soft">{names[wd]}</span>
                  <span className="text-muted">
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
          <h2 className="text-lg font-bold text-ink">Contact</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {venue.contactNumber && (
              <li>
                <a href={`tel:${venue.contactNumber}`} className="hover:text-brand-700">
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
                  className="hover:text-brand-700"
                >
                  {venue.website}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-lg font-bold text-ink">Location</h2>
        <p className="mt-2 text-ink-soft">
          {venue.addressLine ? `${venue.addressLine}, ` : ""}
          {venue.barangay ? `${venue.barangay}, ` : ""}
          {venue.city}
        </p>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          <MapPin className="size-4" aria-hidden /> View on Google Maps
        </a>
      </section>
      {venue.houseRules && (
        <section>
          <h2 className="text-lg font-bold text-ink">House rules</h2>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{venue.houseRules}</p>
        </section>
      )}
    </div>
  );
}

// BookTab — date rail, duration chips, court booking (unchanged logic)
function BookTab({
  venue,
  courts,
  durationMinutes,
  duration,
  dateStr,
  dayChips,
  selectedDateLabel,
  isAuthed,
}: {
  venue: { slug: string };
  courts: CourtDTO[];
  durationMinutes: number;
  duration: string;
  dateStr: string;
  dayChips: DayChip[];
  selectedDateLabel: string;
  isAuthed: boolean;
}) {
  return (
    <div className="py-6">
      <div className="-mx-5">
        <DateRail
          days={dayChips}
          slug={venue.slug}
          dateStr={dateStr}
          duration={duration}
          tab="book"
        />
      </div>
      <div className="mt-3 flex gap-2">
        {DURATIONS.map((dur) => {
          const active = dur.value === duration;
          return (
            <Link
              key={dur.value}
              href={`/venues/${venue.slug}?date=${dateStr}&duration=${dur.value}&tab=book`}
              scroll={false}
              className={cn(
                "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-black/10 bg-white text-ink-soft hover:bg-black/5",
              )}
            >
              {dur.label}
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-sm font-medium text-ink-soft">{longDateLabel(parseIsoDate(dateStr))}</p>
      <div className="mt-3">
        <CourtBooking
          courts={courts}
          durationMinutes={durationMinutes}
          isAuthed={isAuthed}
          returnTo={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}&tab=book`}
          selectedDateLabel={selectedDateLabel}
        />
      </div>
    </div>
  );
}

// ReviewsTab — existing rating + distribution bars + review cards
function ReviewsTab({
  ratingSummary,
  recentReviews,
}: {
  ratingSummary: { avg: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
  recentReviews: Array<{ id: string; rating: number; authorName: string; createdAt: Date; body: string | null }>;
}) {
  if (ratingSummary.count === 0) {
    return <p className="py-8 text-muted">No reviews yet.</p>;
  }
  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-ink">{ratingSummary.avg.toFixed(1)}</span>
          <Stars value={ratingSummary.avg} />
          <span className="text-sm text-muted">{ratingSummary.count} reviews</span>
        </div>
        <ul className="min-w-[12rem] flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = ratingSummary.distribution[n as 1 | 2 | 3 | 4 | 5];
            const pct = ratingSummary.count ? Math.round((c / ratingSummary.count) * 100) : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs text-muted">
                <span className="w-3 text-right">{n}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-6 text-right">{c}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="mt-5 space-y-4">
        {recentReviews.map((r) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="font-medium text-ink">{r.authorName}</span>
                </div>
                <span className="text-xs text-muted">{dateLabel(r.createdAt)}</span>
              </div>
              {r.body && <p className="mt-1.5 text-ink-soft">{r.body}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
