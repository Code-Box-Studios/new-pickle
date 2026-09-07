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
import { Badge } from "@/components/ui/badge";
import { DURATIONS } from "@/lib/search-params";
import { dateLabel, isoDate, longDateLabel, parseIsoDate, weekdayLabel } from "@/lib/format";
import { venueJsonLd } from "@/lib/seo";
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
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true, email: true } } },
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
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {!live && (
        <div className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
          Preview — this venue isn&apos;t live yet. Only you and admins can see this page.
        </div>
      )}
      {live && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(venueJsonLd(venue)) }}
        />
      )}

      <Gallery photos={venue.photos} name={venue.name} />

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{venue.name}</h1>
        <Badge tone="brand">
          <ShieldCheck className="size-3.5" aria-hidden /> Verified
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-1 text-ink-soft">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-semibold text-ink">{venue.ratingAvg.toFixed(1)}</span>
          <span>({venue.ratingCount} reviews)</span>
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-4" aria-hidden />
          {venue.barangay ? `${venue.barangay}, ` : ""}
          {venue.city}
        </span>
      </div>

      {venue.description && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">About</h2>
          <p className="mt-2 text-ink-soft">{venue.description}</p>
        </section>
      )}

      {venue.amenities.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ink">Amenities</h2>
          <div className="mt-3">
            <Amenities amenities={venue.amenities} />
          </div>
        </section>
      )}

      {/* Booking */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">Book a court</h2>

        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const iso = isoDate(d);
            const active = iso === dateStr;
            return (
              <Link
                key={iso}
                href={`/venues/${venue.slug}?date=${iso}&duration=${duration}`}
                scroll={false}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2 text-center",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-black/10 text-ink-soft hover:bg-black/5",
                )}
              >
                <span className="text-[11px] font-medium opacity-80">
                  {weekdayLabel(d).slice(0, 3)}
                </span>
                <span className="text-sm font-semibold">{dateLabel(d)}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          {DURATIONS.map((dur) => {
            const active = dur.value === duration;
            return (
              <Link
                key={dur.value}
                href={`/venues/${venue.slug}?date=${dateStr}&duration=${dur.value}`}
                scroll={false}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-black/10 text-ink-soft hover:bg-black/5",
                )}
              >
                {dur.label}
              </Link>
            );
          })}
        </div>

        <p className="mt-3 text-sm text-muted">{longDateLabel(date)}</p>

        <div className="mt-3">
          <CourtBooking
            courts={courts}
            durationMinutes={durationMinutes}
            isAuthed={!!session}
            returnTo={`/venues/${venue.slug}?date=${dateStr}&duration=${duration}`}
          />
        </div>
      </section>

      {/* Hours */}
      {hoursByDay.size > 0 && (
        <section className="mt-8">
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

      {/* Rules */}
      {venue.houseRules && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink">House rules</h2>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{venue.houseRules}</p>
        </section>
      )}

      {/* Location */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">Location</h2>
        <p className="mt-2 text-ink-soft">
          {venue.addressLine ? `${venue.addressLine}, ` : ""}
          {venue.barangay ? `${venue.barangay}, ` : ""}
          {venue.city}
        </p>
      </section>

      {/* Reviews */}
      <section className="mt-8 mb-8">
        <h2 className="text-lg font-bold text-ink">Reviews</h2>
        {venue.reviews.length === 0 ? (
          <p className="mt-2 text-muted">No reviews yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {venue.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-black/5 p-4">
                <div className="flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                  <span className="font-semibold text-ink">{r.rating}.0</span>
                  <span className="ml-2 text-muted">
                    {r.user.name ?? r.user.email.split("@")[0]}
                  </span>
                </div>
                {r.body && <p className="mt-1.5 text-ink-soft">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
