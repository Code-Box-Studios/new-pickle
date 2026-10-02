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
import { BrandShowcase } from "@/components/ui/brand-showcase";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourtPattern, PaddleIcon, PickleballIcon, RallyScene } from "@/components/ui/pickleball";
import { featuredVenues, listCities } from "@/lib/venues";
import { isoDate } from "@/lib/format";
import { DEFAULT_CITY } from "@/lib/cities";
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
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const defaultDate = isoDate(tomorrow);

  return (
    <>
      <section className="hero-band relative overflow-hidden text-white">
        <div className="page-shell relative pb-24 pt-[136px] sm:pb-28 sm:pt-[168px] lg:pb-32 lg:pt-48">
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
                <span className="hero-accent text-brand-200">{content.heroAccent}</span>
              </h1>
              <p className="motion-enter motion-delay-2 mt-6 max-w-md text-lg leading-relaxed text-white/70">
                {content.heroDescription}
              </p>
              <div className="motion-enter motion-delay-3 mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="serve-button">
                  <a href={content.primaryHref}>
                    {content.primaryLabel} <PickleballIcon className="serve-ball size-5" />
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
            <div className="motion-enter motion-delay-2 min-w-0">
              <BrandShowcase />
            </div>
          </div>
        </div>
      </section>

      <div
        id="find-courts"
        className="page-shell motion-enter motion-delay-3 relative z-10 -mt-12 scroll-mt-24"
      >
        <SearchBar
          heading={content.primaryLabel}
          cities={cities}
          defaultCity={DEFAULT_CITY}
          defaultDate={defaultDate}
        />
      </div>

      <section className="page-shell reveal-section py-16 lg:py-24">
        <div className="relative flex flex-wrap items-end justify-between gap-5 border-b border-border pb-8">
          <div>
            <p className="eyebrow mb-3 flex items-center gap-2"><PaddleIcon className="size-4" />{content.popularEyebrow}</p>
            <h2 className="section-title">{content.popularTitle}</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {content.popularDescription}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/search" className="motion-trigger">
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
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_420px]">
            <div>
              <p className="eyebrow mb-3">{content.stepsEyebrow}</p>
              <h2 className="section-title">{content.stepsTitle}</h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                {content.stepsDescription}
              </p>
            </div>
            <RallyScene className="mx-auto w-full max-w-[420px]" />
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {content.steps.map((step, index) => {
              const Icon = stepIcons[step.icon] ?? MapPin;
              return (
                <Card key={step.title} className="feature-card court-step relative overflow-hidden p-6 sm:p-8">
                  <CourtPattern className="pointer-events-none absolute -right-16 -top-8 w-64 rotate-[-25deg] text-brand-700 opacity-[0.045]" />
                  <div className="relative mb-7 flex items-center justify-between gap-3">
                    <span className="grid size-12 place-items-center rounded-lg bg-secondary text-brand-700">
                      <Icon className="size-6" strokeWidth={1.7} aria-hidden />
                    </span>
                    <span className="court-score grid size-10 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-sm font-semibold tabular-nums tracking-wider text-brand-700">
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
        <Card className="hero-band owner-cta relative overflow-hidden border-0 bg-brand-teal-deep p-8 text-white sm:p-12 lg:p-16">
          <CourtPattern className="pointer-events-none absolute -right-24 -top-12 w-[700px] rotate-[-24deg] text-white opacity-[0.065]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_280px] lg:gap-16">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[1px] text-brand-200">
              <PaddleIcon className="size-4" />
              {content.ownerEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {content.ownerTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
              {content.ownerDescription}
            </p>
            <Button asChild size="lg" className="motion-trigger mt-7">
              <Link href={content.ownerHref}>
                {content.ownerLabel} <ArrowRight className="motion-arrow" data-direction="right" aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="owner-court-art mx-auto hidden w-full max-w-[280px] -rotate-6 rounded-xl border border-brand-300/25 bg-brand-950/40 p-6 lg:block" aria-hidden="true">
            <svg viewBox="0 0 220 260" fill="none" className="w-full">
              <rect x="28" y="14" width="164" height="232" rx="4" fill="#00684a" stroke="#b9f5d0" strokeWidth="2" />
              <path d="M28 92h164M28 168h164M110 14v78M110 168v78" stroke="#b9f5d0" strokeWidth="2" />
              <path d="M28 92h164v76H28z" fill="#001e2b" fillOpacity=".25" />
              <path d="M18 130h184" stroke="#e3fcf7" strokeWidth="3" />
              <path d="M28 125h164M28 135h164" stroke="#e3fcf7" strokeDasharray="2 4" strokeOpacity=".3" />
              <circle cx="18" cy="130" r="4" fill="#e3fcf7" />
              <circle cx="202" cy="130" r="4" fill="#e3fcf7" />
              <circle cx="149" cy="201" r="13" fill="#00ed64" />
              <g fill="#00513b"><circle cx="145" cy="197" r="2" /><circle cx="154" cy="199" r="2" /><circle cx="149" cy="206" r="2" /></g>
            </svg>
          </div>
          </div>
        </Card>
      </section>
    </>
  );
}
