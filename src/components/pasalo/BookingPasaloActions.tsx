"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateListingInput, ListingStatus } from "@/lib/pasalo/types";
import { pasaloRequest } from "./pasalo-client";
import { PasaloError, pasaloPrice, PasaloRiskDisclosure } from "./PasaloShared";

export interface BookingPasaloActionsProps {
  bookingId: string;
  originalPriceCents: number;
  listingId?: string | null;
  listingStatus?: ListingStatus;
  eligible: boolean;
}

export function BookingPasaloActions({ bookingId, originalPriceCents, listingId, listingStatus, eligible }: BookingPasaloActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [channel, setChannel] = useState<"GCASH" | "MAYA">("GCASH");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const value = price.trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    const priceCents = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : NaN;
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || priceCents >= originalPriceCents) {
      setError(`Enter a positive price below ${pasaloPrice(originalPriceCents)}, with up to two decimal places.`); return;
    }
    if (!accountName.trim() || !accountNumber.trim()) { setError("Enter your receiving account name and number."); return; }
    setPending(true); setError(null);
    try {
      const input: CreateListingInput = { bookingId, priceCents, paymentChannel: channel, paymentAccountName: accountName.trim(), paymentAccountNumber: accountNumber.trim(), ...(note.trim() ? { note: note.trim() } : {}) };
      const result = await pasaloRequest<{ id: string }>("/api/pasalo", input);
      setOpen(false); router.push(`/pasalo/${result.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create this offer."); }
    finally { setPending(false); }
  }

  if (!listingId && !eligible) return null;
  const manageExisting = !!listingId && (!eligible || ["ACTIVE", "RESERVED", "SOLD"].includes(listingStatus ?? "ACTIVE"));
  return <>
    <Card className="gap-4 rounded-2xl bg-white p-5"><div className="flex items-start gap-3"><ArrowRightLeft className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden /><div className="min-w-0"><h2 className="font-semibold text-ink">{manageExisting ? "Your Pasalo offer" : "Plans changed? Pasalo your booking."}</h2><p className="mt-1 text-sm leading-relaxed text-ink-soft">{manageExisting ? "Open your offer to manage it or talk to its buyer. Withdraw an unsold offer before cancelling or rescheduling." : "Offer your whole booking to another player for less than your original paid price."}</p></div></div>{manageExisting ? <Button asChild variant="outline"><Link href={`/pasalo/${listingId}`}>Manage Pasalo offer</Link></Button> : <Button variant="outline" onClick={() => setOpen(true)}>Create Pasalo offer</Button>}</Card>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Offer your booking</DialogTitle><DialogDescription>The court, date, and duration stay fixed. Your offer closes 30 minutes before play.</DialogDescription></DialogHeader><form onSubmit={create} className="space-y-4">
      {error && <PasaloError message={error} />}
      <div className="space-y-2"><Label htmlFor="pasalo-transfer-price">Transfer price (PHP)</Label><Input id="pasalo-transfer-price" type="text" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder="e.g. 750.50" required aria-describedby="pasalo-price-help" /><p id="pasalo-price-help" className="text-xs text-ink-soft">Original paid price: {pasaloPrice(originalPriceCents)}. Your offer must be lower.</p></div>
      <div className="space-y-2"><Label htmlFor="pasalo-wallet">Receiving wallet</Label><Select value={channel} onValueChange={value => setChannel(value as "GCASH" | "MAYA")}><SelectTrigger id="pasalo-wallet" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GCASH">GCash</SelectItem><SelectItem value="MAYA">Maya</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="pasalo-account-name">Wallet account name</Label><Input id="pasalo-account-name" value={accountName} onChange={event => setAccountName(event.target.value)} maxLength={100} required autoComplete="name" /></div>
      <div className="space-y-2"><Label htmlFor="pasalo-account-number">Wallet mobile number</Label><Input id="pasalo-account-number" type="tel" value={accountNumber} onChange={event => setAccountNumber(event.target.value)} maxLength={24} required autoComplete="tel" placeholder="09xx xxx xxxx" /><p className="text-xs leading-relaxed text-ink-soft">Your wallet details are visible only to you and the buyer who reserves your offer.</p></div>
      <div className="space-y-2"><Label htmlFor="pasalo-offer-note">Offer note (optional)</Label><Textarea id="pasalo-offer-note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Share a short note about the offer." /><p className="text-xs text-ink-soft">Your note is public. Keep phone numbers and payment details out of it.</p></div>
      <PasaloRiskDisclosure />
      <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Publish offer</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </>;
}
