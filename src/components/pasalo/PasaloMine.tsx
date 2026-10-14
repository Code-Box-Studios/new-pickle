"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/page-loading";
import type { PasaloMineView } from "@/lib/pasalo/types";
import { usePasaloResource } from "./pasalo-client";
import { PasaloEmpty, PasaloError, PasaloListingCard, PasaloShell, PasaloStatus } from "./PasaloShared";
import { PasaloConversations } from "./PasaloConversations";

export function PasaloMine() {
  const { data, error, loading, refresh } = usePasaloResource<PasaloMineView>("/api/pasalo/mine");
  return <PasaloShell title="My Pasalo" description="Keep track of offers you’re selling and bookings you’re picking up." back={{ href: "/pasalo", label: "Browse Pasalo" }}>
    {error && <div className="mb-5"><PasaloError message={error} retry={() => void refresh()} /></div>}
    {!data && loading ? <PageLoading /> : data && <div className="space-y-10">
      <section aria-labelledby="pasalo-selling-title"><h2 id="pasalo-selling-title" className="mb-4 text-lg font-semibold text-ink">Selling</h2>{data.selling.length ? <div className="grid min-w-0 gap-5 md:grid-cols-2">{data.selling.map(({ listing, conversations, hasOlderConversations }) => <PasaloListingCard key={listing.id} listing={listing}><div className="flex flex-col gap-2"><Button asChild variant="outline"><Link href={`/pasalo/${listing.id}`}>Manage offer</Link></Button><PasaloConversations listingId={listing.id} conversations={conversations} hasOlder={hasOlderConversations} /></div></PasaloListingCard>)}</div> : <PasaloEmpty title="No selling offers yet" description="Open a confirmed paid booking to offer your whole session at a lower price." action={<Button asChild variant="outline"><Link href="/bookings">My bookings</Link></Button>} />}</section>
      <section aria-labelledby="pasalo-buying-title"><h2 id="pasalo-buying-title" className="mb-4 text-lg font-semibold text-ink">Buying</h2>{data.buying.length ? <div className="grid min-w-0 gap-5 md:grid-cols-2">{data.buying.map(({ listing, trade }) => <PasaloListingCard key={trade.id} listing={listing}><div className="flex flex-col gap-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-soft">Your trade</span><PasaloStatus status={trade.status} /></div><Button asChild variant="outline"><Link href={`/pasalo/trades/${trade.id}`}>Open private conversation</Link></Button></div></PasaloListingCard>)}</div> : <PasaloEmpty title="No buying reservations yet" description="Find a discounted session and reserve an offer to talk privately with its seller." action={<Button asChild variant="outline"><Link href="/pasalo">Browse offers</Link></Button>} />}</section>
    </div>}
  </PasaloShell>;
}
