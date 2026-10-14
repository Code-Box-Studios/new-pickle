"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/ui/page-loading";
import type { ClaimInput, PasaloDetailView } from "@/lib/pasalo/types";
import { pasaloRequest, usePasaloResource } from "./pasalo-client";
import { PasaloBookingFacts, PasaloError, PasaloPriceSummary, PasaloRiskDisclosure, PasaloShell, PasaloStatus } from "./PasaloShared";

export function PasaloDetail({ listingId, isAuthed, customerName = "", customerMobile = "" }: {
  listingId: string; isAuthed: boolean; customerName?: string; customerMobile?: string;
}) {
  const router = useRouter();
  const { data, error, loading, refresh } = usePasaloResource<PasaloDetailView>(`/api/pasalo/${encodeURIComponent(listingId)}`);
  const [dialog, setDialog] = useState<"claim" | "withdraw" | null>(null);
  const [name, setName] = useState(customerName);
  const [mobile, setMobile] = useState(customerMobile);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function claim(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim() || !mobile.trim()) { setActionError("Enter the new booking holder’s name and mobile number."); return; }
    setPending(true); setActionError(null);
    try {
      const input: ClaimInput = { customerName: name.trim(), customerMobile: mobile.trim() };
      const result = await pasaloRequest<{ tradeId: string }>(`/api/pasalo/${encodeURIComponent(listingId)}/claim`, input);
      router.push(`/pasalo/trades/${result.tradeId}`);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not reserve this offer."); }
    finally { setPending(false); }
  }

  async function withdraw() {
    if (pending) return;
    setPending(true); setActionError(null);
    try {
      await pasaloRequest(`/api/pasalo/${encodeURIComponent(listingId)}/withdraw`, {});
      setDialog(null); await refresh(); router.refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not withdraw this offer."); }
    finally { setPending(false); }
  }

  return (
    <PasaloShell title="Booking offer" back={{ href: "/pasalo", label: "All Pasalo offers" }}>
      {error && <div className="mb-5"><PasaloError message={error} retry={() => void refresh()} /></div>}
      {!data && loading ? <PageLoading /> : data && <div className="grid min-w-0 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="min-w-0 gap-6 rounded-2xl bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 text-xl font-semibold text-ink">{data.listing.venueName}</h2><PasaloStatus status={data.listing.status} /></div><PasaloBookingFacts listing={data.listing} />{data.listing.note && <div className="border-t border-line pt-5"><h3 className="mb-2 text-sm font-semibold text-ink">Seller’s note</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{data.listing.note}</p></div>}<p className="text-sm leading-relaxed text-ink-soft">The entire booking transfers with the court, date, and duration shown above. The venue keeps its original payment.</p></Card>
        <div className="min-w-0 space-y-5"><Card className="gap-5 rounded-2xl bg-white p-5 sm:p-7"><PasaloPriceSummary listing={data.listing} />
          {data.myTradeId ? <Button asChild className="w-full"><Link href={`/pasalo/trades/${data.myTradeId}`}>Open private conversation</Link></Button>
            : data.isSeller ? <p className="text-sm text-ink-soft">This is your offer.</p>
              : !isAuthed && data.listing.status === "ACTIVE" ? <Button asChild className="w-full"><Link href={`/login?next=${encodeURIComponent(`/pasalo/${listingId}`)}`}>Sign in to reserve</Link></Button>
                : data.canClaim ? <Button onClick={() => { setActionError(null); setDialog("claim"); }}>Reserve this offer</Button>
                  : <p className="text-sm text-ink-soft">This offer is unavailable to reserve.</p>}
          {data.isSeller && ["ACTIVE", "RESERVED"].includes(data.listing.status) && <Button variant="outline" onClick={() => { setActionError(null); setDialog("withdraw"); }}>Withdraw offer</Button>}
          <p className="text-xs leading-relaxed text-ink-soft">A reservation lasts 10 minutes. Payment account details appear in your private conversation after reserving.</p>
        </Card><PasaloRiskDisclosure /></div>
      </div>}
      <Dialog open={dialog !== null} onOpenChange={open => { if (!pending && !open) setDialog(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{dialog === "withdraw" ? "Withdraw this offer?" : "Reserve this booking"}</DialogTitle><DialogDescription>{dialog === "withdraw" ? "This removes the offer from Pasalo. Your original booking stays with you. An offer with payment already sent cannot be withdrawn." : "Enter the person who will hold the booking. You’ll have 10 minutes to arrange direct payment with the seller."}</DialogDescription></DialogHeader>
          {actionError && <PasaloError message={actionError} />}
          {dialog === "claim" ? <form onSubmit={claim} className="space-y-4"><div className="space-y-2"><Label htmlFor="pasalo-holder-name">Booking holder name</Label><Input id="pasalo-holder-name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} autoComplete="name" /></div><div className="space-y-2"><Label htmlFor="pasalo-holder-mobile">Mobile number</Label><Input id="pasalo-holder-mobile" type="tel" value={mobile} onChange={event => setMobile(event.target.value)} required maxLength={24} autoComplete="tel" placeholder="09xx xxx xxxx" /></div><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" loading={pending}>Reserve for 10 minutes</Button></DialogFooter></form> : <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDialog(null)}>Keep offer</Button><Button loading={pending} onClick={() => void withdraw()}>Withdraw offer</Button></DialogFooter>}
        </DialogContent>
      </Dialog>
    </PasaloShell>
  );
}
