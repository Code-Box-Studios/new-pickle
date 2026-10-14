"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/ui/page-loading";
import type { PasaloListingView } from "@/lib/pasalo/types";
import { usePasaloResource } from "./pasalo-client";
import { PasaloEmpty, PasaloError, PasaloListingCard, PasaloRiskDisclosure, PasaloShell } from "./PasaloShared";

export function PasaloDiscovery() {
  const [city, setCity] = useState("");
  const [filter, setFilter] = useState("");
  const { data, error, loading, refresh } = usePasaloResource<{ listings: PasaloListingView[] }>(`/api/pasalo${filter ? `?city=${encodeURIComponent(filter)}` : ""}`);
  return (
    <PasaloShell title="Pasalo" description="Pick up another player’s paid court booking for less. Same court, same time, a new player." actions={<Button asChild variant="outline"><Link href="/pasalo/mine">My Pasalo</Link></Button>}>
      <div className="mb-7 space-y-5">
        <PasaloRiskDisclosure />
        <form onSubmit={event => { event.preventDefault(); setFilter(city.trim()); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1"><Label htmlFor="pasalo-city" className="mb-2">Find offers in your city</Label><Input id="pasalo-city" placeholder="All cities" value={city} maxLength={100} onChange={event => setCity(event.target.value)} className="h-11 bg-white" /></div>
          <Button type="submit"><Search className="size-4" aria-hidden />Find offers</Button>
          {filter && <Button type="button" variant="ghost" onClick={() => { setCity(""); setFilter(""); }}>Clear</Button>}
        </form>
      </div>
      {error && <div className="mb-5"><PasaloError message={error} retry={() => void refresh()} /></div>}
      {!data && loading ? <PageLoading /> : data && (data.listings.length ? <div className="grid min-w-0 gap-5 md:grid-cols-2 lg:grid-cols-3">{data.listings.map(listing => <PasaloListingCard key={listing.id} listing={listing} />)}</div> : <PasaloEmpty title="No offers right now" description={filter ? `No available Pasalo bookings in ${filter}. Try another city or check again soon.` : "Available bookings will appear here when players offer their paid sessions."} action={<Button asChild variant="outline"><Link href="/search">Find a court</Link></Button>} />)}
      <p className="mt-7 text-sm leading-relaxed text-ink-soft">Selling a booking? Open an eligible confirmed booking from <Link href="/bookings" className="font-semibold text-brand-700 underline underline-offset-4">My bookings</Link> to create your offer. Offers close 30 minutes before play.</p>
    </PasaloShell>
  );
}
