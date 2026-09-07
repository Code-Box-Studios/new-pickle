import { CalendarCheck, MapPin, Trophy } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";
import { VenueCard } from "@/components/venue/VenueCard";
import { featuredVenues, listCities } from "@/lib/venues";
import { isoDate } from "@/lib/format";

export default async function HomePage() {
  const [cities, venues] = await Promise.all([listCities(), featuredVenues()]);
  const cityOptions = cities.length ? cities : ["Davao City"];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const defaultDate = isoDate(tomorrow);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-12 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              Pickleball courts in Davao
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              Find your next game.
            </h1>
            <p className="mt-3 text-lg text-muted">
              Search real-time court availability across independent venues.
              Reserve in seconds, pay the venue, and play.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-4xl">
            <SearchBar
              cities={cityOptions}
              defaultCity={cityOptions[0]}
              defaultDate={defaultDate}
            />
          </div>
        </div>
      </section>

      {/* Featured venues */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-bold text-ink">Popular venues</h2>
        <p className="mt-1 text-muted">Highly rated courts near you.</p>
        {venues.length === 0 ? (
          <p className="mt-6 text-muted">No venues listed yet — check back soon.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.slug} venue={v} isoDate={defaultDate} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-black/5 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-xl font-bold text-ink">How RallyPoint works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: MapPin, title: "Discover", body: "Search courts by location, date, and time — see what's actually free." },
              { icon: CalendarCheck, title: "Reserve & pay the venue", body: "Hold your slot, then pay the venue directly via GCash or Maya." },
              { icon: Trophy, title: "Play", body: "The venue confirms your booking. Show up and rally." },
            ].map((s) => (
              <div key={s.title} className="text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                  <s.icon className="size-6" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
