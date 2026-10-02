import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  MapPin,
  Trophy,
  Wallet,
  ShieldCheck,
  LineChart,
} from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { VenueCard } from "@/components/venue/VenueCard";
import { FeaturedCourtsSlideshow } from "@/components/venue/FeaturedCourtsSlideshow";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { featuredVenues, listCities } from "@/lib/venues";
import { isoDate } from "@/lib/format";
import { getHomeContent } from "@/cms/content";
const stepIcons = {
  map: MapPin,
  calendar: CalendarCheck,
  trophy: Trophy,
  shield: ShieldCheck,
  chart: LineChart,
};

export default async function HomePage() {
  const [cities, venues, content] = await Promise.all([
    listCities(),
    featuredVenues(),
    getHomeContent(),
  ]);
  const cityOptions = cities.length ? cities : ["Davao City"];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const defaultDate = isoDate(tomorrow);
  const heroCourts = venues
    .filter((venue) => venue.photos.length > 0)
    .map((venue) => ({
      slug: venue.slug,
      name: venue.name,
      city: venue.city,
      photo: venue.photos[0],
    }));

  return (
    <>
      <section className="hero-band relative overflow-hidden text-white">
        <svg
          className="hero-court-lines"
          viewBox="0 0 600 800"
          fill="none"
          aria-hidden="true"
        >
          <rect x="40" y="40" width="520" height="720" rx="12" />
          <path d="M40 285h520M40 515h520M300 40v245M300 515v245M40 400h520" />
        </svg>
        <div className="page-shell relative pb-24 pt-12 sm:pb-28 sm:pt-20 lg:pb-32 lg:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.12fr_1fr] lg:gap-16">
            <div className="max-w-xl">
              <Badge
                variant="outline"
                className="motion-enter gap-2 border-white/20 bg-white/5 px-3 py-1.5 text-white/80"
              >
                <MapPin className="size-3.5 text-primary" aria-hidden />
                {content.heroEyebrow}
              </Badge>
              <h1 className="hero-title motion-enter motion-delay-1 mt-6">
                {content.heroTitle}
                <br />
                <span className="text-brand-200">{content.heroAccent}</span>
              </h1>
              <p className="motion-enter motion-delay-2 mt-6 max-w-md text-lg leading-relaxed text-white/70">
                {content.heroDescription}
              </p>
              <div className="motion-enter motion-delay-3 mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={content.primaryHref}>
                    {content.primaryLabel} <ArrowRight aria-hidden />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outlineOnDark">
                  <Link href={content.secondaryHref}>
                    {content.secondaryLabel}
                  </Link>
                </Button>
              </div>
              <div className="motion-enter motion-delay-4 mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/65">
                <span className="flex items-center gap-2">
                  <CalendarCheck
                    className="size-4 text-brand-300"
                    aria-hidden
                  />
                  {content.availabilityLabel}
                </span>
                <span className="flex items-center gap-2">
                  <Wallet className="size-4 text-brand-300" aria-hidden />
                  {content.paymentLabel}
                </span>
              </div>
            </div>
            <div className="motion-enter motion-delay-2 hidden min-w-0 lg:block">
              {heroCourts.length > 0 ? (
                <FeaturedCourtsSlideshow
                  courts={heroCourts}
                  isoDate={defaultDate}
                />
              ) : (
                <Card
                  className="hidden aspect-[5/4] place-items-center border-white/15 bg-brand-teal-mid p-12 lg:grid"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 300 380"
                    className="h-full text-brand-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="32" y="20" width="236" height="340" rx="3" />
                    <path d="M32 138h236M32 242h236M150 20v118M150 242v118M32 190h236" />
                    <circle
                      cx="220"
                      cy="282"
                      r="9"
                      fill="var(--primary)"
                      stroke="none"
                    />
                  </svg>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      <div
        id="find-courts"
        className="page-shell motion-enter motion-delay-3 relative z-10 -mt-12 scroll-mt-24"
      >
        <SearchBar
          cities={cityOptions}
          defaultCity={cityOptions[0]}
          defaultDate={defaultDate}
        />
      </div>

      <section className="page-shell reveal-section py-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow mb-3">{content.popularEyebrow}</p>
            <h2 className="section-title">{content.popularTitle}</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {content.popularDescription}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/search">
              {content.exploreLabel} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        {venues.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-6" aria-hidden />}
            title="No venues listed yet"
            description="Check back soon for a place to play."
          />
        ) : (
          <div className="stagger-enter mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.slug} venue={v} isoDate={defaultDate} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-canvas">
        <div className="page-shell reveal-section py-16 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-3">{content.stepsEyebrow}</p>
              <h2 className="section-title">{content.stepsTitle}</h2>
            </div>
            <p className="max-w-xs text-base leading-relaxed text-muted-foreground">
              {content.stepsDescription}
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {content.steps.map((step, index) => {
              const Icon = stepIcons[step.icon] ?? MapPin;
              return (
                <Card key={step.title} className="feature-card p-6 sm:p-8">
                  <div className="mb-7 flex items-center justify-between gap-3">
                    <span className="grid size-12 place-items-center rounded-lg bg-secondary text-brand-700">
                      <Icon className="size-6" strokeWidth={1.7} aria-hidden />
                    </span>
                    <span className="text-2xl font-medium tabular-nums tracking-tight text-border">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="text-[22px] font-medium leading-snug text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section className="page-shell reveal-section py-16 lg:py-24">
        <Card className="hero-band relative grid gap-8 overflow-hidden border-0 bg-brand-teal-deep p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center lg:p-16">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-white/60">
              {content.ownerEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {content.ownerTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
              {content.ownerDescription}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={content.ownerHref}>
              {content.ownerLabel} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Card>
      </section>
    </>
  );
}
