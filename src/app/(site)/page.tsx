import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock3, MapPin, Trophy } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { VenueCard } from "@/components/venue/VenueCard";
import { FeaturedCourtsSlideshow } from "@/components/venue/FeaturedCourtsSlideshow";
import { EmptyState } from "@/components/ui/states";
import { featuredVenues, listCities } from "@/lib/venues";
import { isoDate } from "@/lib/format";

export default async function HomePage() {
  const [cities, venues] = await Promise.all([listCities(), featuredVenues()]);
  const cityOptions = cities.length ? cities : ["Davao City"];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const defaultDate = isoDate(tomorrow);
  const heroCourts = venues.filter((venue) => venue.photos.length > 0).map((venue) => ({
    slug: venue.slug, name: venue.name, city: venue.city, photo: venue.photos[0],
  }));

  return (
    <>
      <section className="bg-canvas">
        <div className="page-shell pb-10 pt-10 sm:pb-12 sm:pt-14 lg:pt-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1.12fr_1fr] lg:gap-x-16 lg:gap-y-10">
            <div className="order-1 max-w-xl lg:py-6">
              <p className="eyebrow flex items-center gap-2">
                <MapPin className="size-3.5" aria-hidden />
                Pickleball courts for everyone
              </p>
              <h1 className="mt-5 text-[clamp(2.75rem,5.2vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-ink">
                Find your{" "}<br /><span className="text-brand-700">next game.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              Search real-time court availability across independent venues.
              Reserve in seconds, pay the venue, and play.
              </p>
              <p className="mt-6 flex items-center gap-2 text-xs font-medium text-ink-soft sm:text-sm">
                <Clock3 className="size-4 text-brand-600" aria-hidden />
                Live availability. A little more time to play.
              </p>
            </div>
            <div className="order-2 min-w-0 lg:order-3 lg:col-span-2">
              <SearchBar
                cities={cityOptions}
                defaultCity={cityOptions[0]}
                defaultDate={defaultDate}
              />
            </div>
            {heroCourts.length > 0 ? (
              <div className="order-3 min-w-0 lg:order-2">
                <FeaturedCourtsSlideshow courts={heroCourts} isoDate={defaultDate} />
              </div>
            ) : (
              <div className="relative order-3 hidden aspect-[5/4] overflow-hidden rounded-[2rem] bg-mist p-12 lg:order-2 lg:grid lg:place-items-center" aria-hidden="true">
                <svg viewBox="0 0 300 380" className="h-full text-brand-300" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="32" y="20" width="236" height="340" rx="3" />
                  <path d="M32 138h236M32 242h236M150 20v118M150 242v118M32 190h236" />
                  <circle cx="220" cy="282" r="9" fill="var(--color-brand-700)" stroke="none" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="page-shell py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow mb-3">Find your court</p>
            <h2 className="section-title">Popular venues</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">Highly rated courts near you.</p>
          </div>
          <Link href="/search" className="motion-trigger inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-700 transition-colors hover:text-brand-950">
            Explore all courts <ArrowRight className="motion-arrow size-4" data-direction="right" aria-hidden />
          </Link>
        </div>
        {venues.length === 0 ? (
          <EmptyState icon={<MapPin className="size-6" aria-hidden />} title="No venues listed yet" description="Check back soon for a place to play." />
        ) : (
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.slug} venue={v} isoDate={defaultDate} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-mist">
        <div className="page-shell py-12 sm:py-16">
          <p className="eyebrow mb-3">Less planning. More playing.</p>
          <h2 className="section-title">How RallyPoint works</h2>
          <div className="mt-9 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {[
              { icon: MapPin, title: "Discover", body: "Search courts by location, date, and time — see what's actually free." },
              { icon: CalendarCheck, title: "Reserve & pay the venue", body: "Hold your slot, then pay the venue directly via GCash or Maya." },
              { icon: Trophy, title: "Play", body: "The venue confirms your booking. Show up and rally." },
            ].map((s, index) => (
              <div key={s.title}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-white text-brand-700"><s.icon className="size-5" strokeWidth={1.7} aria-hidden /></span>
                  <span className="text-xs font-medium tabular-nums text-muted">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-ink">{s.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
