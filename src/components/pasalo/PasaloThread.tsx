"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { LockKeyhole, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/ui/page-loading";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { dateLabel, timeLabel } from "@/lib/format";
import type { PasaloMessageView, PasaloThreadView } from "@/lib/pasalo/types";
import { pasaloRequest, usePasaloResource } from "./pasalo-client";
import { PasaloBookingFacts, PasaloError, pasaloPrice, PasaloRiskDisclosure, PasaloShell, PasaloStatus } from "./PasaloShared";

function messageTime(value: string) {
  // Chat timestamps are actual UTC instants; booking timestamps are Manila civil time.
  const manila = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return `${dateLabel(manila)} · ${timeLabel(manila)}`;
}

export function PasaloThread({ tradeId }: { tradeId: string }) {
  const path = `/api/pasalo/trades/${encodeURIComponent(tradeId)}`;
  const { data, error, loading, refresh } = usePasaloResource<PasaloThreadView>(path, 5000);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [older, setOlder] = useState<PasaloMessageView[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"payment" | "transfer" | "release" | null>(null);
  const [reference, setReference] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transferred, setTransferred] = useState(false);
  const [released, setReleased] = useState(false);
  const [paymentDeclared, setPaymentDeclared] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") setNow(Date.now()); }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const messages = useMemo(() => {
    const byId = new Map<string, PasaloMessageView>();
    for (const message of [...older, ...(data?.messages ?? [])]) byId.set(message.id, message);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }, [older, data?.messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || !draft.trim()) return;
    if (draft.trim().length > 1000) { setMessageError("Keep your message within 1000 characters."); return; }
    const submitted = draft;
    setSending(true); setMessageError(null);
    try {
      await pasaloRequest(`${path}/messages`, { body: submitted.trim() });
      setDraft(current => current === submitted ? "" : current);
      await refresh();
    } catch (cause) { setMessageError(cause instanceof Error ? cause.message : "Message could not be sent. Your draft is saved here."); }
    finally { setSending(false); }
  }

  async function loadOlder() {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true); setOlderError(null);
    try {
      const previous = await pasaloRequest<PasaloThreadView>(`${path}?before=${encodeURIComponent(messages[0].id)}`);
      setOlder(current => [...current, ...(data?.messages ?? []), ...previous.messages]);
      setOlderHasMore(previous.hasOlder);
    } catch (cause) { setOlderError(cause instanceof Error ? cause.message : "Could not load older messages."); }
    finally { setLoadingOlder(false); }
  }

  async function act(event: FormEvent) {
    event.preventDefault();
    if (pending || !dialog || !acknowledged) return;
    if (dialog === "payment" && !activeReservation) {
      setActionError("This reservation is no longer available for payment."); return;
    }
    const action = dialog;
    setPending(true); setActionError(null);
    try {
      const body = action === "payment" ? { sent: true, ...(reference.trim() ? { reference: reference.trim() } : {}) } : action === "transfer" ? { received: true } : { notPaid: true };
      await pasaloRequest(`${path}/${action}`, body);
      if (action === "transfer") setTransferred(true);
      if (action === "release") setReleased(true);
      if (action === "payment") setPaymentDeclared(true);
      setDialog(null); await refresh();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not complete this action."); }
    finally { setPending(false); }
  }

  function openDialog(value: "payment" | "transfer" | "release") {
    setAcknowledged(false); setActionError(null); setDialog(value);
  }

  const status = transferred ? "TRANSFERRED" : released ? "RELEASED" : paymentDeclared && data?.trade.status === "RESERVED" ? "PAYMENT_SENT" : data?.trade.status;
  const secondsLeft = data ? Math.max(0, Math.ceil((new Date(data.trade.expiresAt).getTime() - now) / 1000)) : 0;
  const expired = status === "RESERVED" && secondsLeft === 0;
  const activeReservation = status === "RESERVED" && !expired;
  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <PasaloShell title="Private Pasalo conversation" description="Only you and the other player can read this conversation." back={{ href: "/pasalo/mine", label: "My Pasalo" }}>
      {error && <div className="mb-5"><PasaloError message={error} retry={() => void refresh()} /></div>}
      {!data && loading ? <PageLoading /> : data && <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="min-w-0 space-y-5">
          <Card className="min-w-0 gap-5 rounded-2xl bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-ink">{data.role === "BUYER" ? "Your reservation" : "Your booking offer"}</h2>{status && <PasaloStatus status={expired ? "EXPIRED" : status} />}</div><PasaloBookingFacts listing={data.listing} /><div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4"><span className="text-sm text-ink-soft">Transfer price</span><span className="text-2xl font-semibold text-brand-700">{pasaloPrice(data.trade.priceCents)}</span></div>
            {activeReservation && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">Reserved for <strong className="tabular-nums">{timerLabel}</strong>. Arrange payment before this reservation expires.</p>}
            {expired && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your reservation expired. Do not send payment for this trade.</p>}
            {status === "PAYMENT_SENT" && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">{data.role === "BUYER" ? "Waiting for the seller to confirm receipt in their wallet. Your booking transfers only after that confirmation." : "The buyer marked payment sent. Check your own wallet before confirming receipt. A message or screenshot does not verify payment."}</p>}
            {status === "TRANSFERRED" && <div className="space-y-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900"><p className="font-semibold">Booking transferred.</p>{data.role === "BUYER" ? <><p>This booking now belongs to you.</p>{data.bookingReference && <><p>New booking reference: <strong className="break-all">{data.bookingReference}</strong></p><Button asChild variant="outline" className="w-full"><Link href={`/bookings/${encodeURIComponent(data.bookingReference)}`}>View your booking</Link></Button></>}</> : <p>The buyer now holds the booking. The venue keeps its original payment.</p>}</div>}
            {(status === "RELEASED" || status === "EXPIRED" || status === "VOIDED") && <p className="text-sm leading-relaxed text-ink-soft">This trade is closed. Keep using this conversation to resolve any direct payment questions.</p>}
          </Card>
          {status !== "TRANSFERRED" && <Card className="min-w-0 gap-4 rounded-2xl bg-white p-5"><h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Wallet className="size-5 text-brand-700" aria-hidden />{data.role === "BUYER" ? `Seller’s ${data.payment.channel === "GCASH" ? "GCash" : "Maya"} account` : "Your receiving account"}</h2><dl className="space-y-3 text-sm"><div><dt className="text-ink-soft">Account name</dt><dd className="mt-1 break-words font-semibold text-ink">{data.payment.accountName}</dd></div><div><dt className="text-ink-soft">Account number</dt><dd className="mt-1 break-all font-semibold tracking-wide text-ink">{data.payment.accountNumber}</dd></div></dl>{data.trade.paymentReference && <p className="break-words text-sm text-ink-soft">Buyer’s payment reference: {data.trade.paymentReference}</p>}
            {data.role === "BUYER" && activeReservation && <div className="flex flex-col gap-2"><Button onClick={() => openDialog("payment")}>I sent payment</Button><Button variant="outline" onClick={() => openDialog("release")}>Release reservation</Button></div>}
            {data.role === "SELLER" && status === "PAYMENT_SENT" && <Button onClick={() => openDialog("transfer")}>Confirm receipt in my wallet</Button>}
          </Card>}
          <PasaloRiskDisclosure />
        </div>
        <Card className="min-w-0 gap-0 overflow-hidden rounded-2xl bg-white p-0">
          <div className="flex items-center justify-between gap-2 border-b border-line p-5"><h2 className="text-base font-semibold text-ink">Conversation</h2><span className="flex items-center gap-1.5 text-xs text-ink-soft"><LockKeyhole className="size-3.5" aria-hidden />Private</span></div>
          <div className="max-h-[32rem] min-h-40 space-y-4 overflow-y-auto p-4 sm:p-5" role="log" aria-label="Private messages" aria-live="polite" aria-relevant="additions">
            {(olderHasMore ?? data.hasOlder) && <div className="text-center"><Button variant="outline" size="sm" loading={loadingOlder} onClick={() => void loadOlder()}>Load older messages</Button></div>}
            {olderError && <PasaloError message={olderError} retry={() => void loadOlder()} />}
            {messages.length === 0 && <p className="py-6 text-center text-sm leading-relaxed text-ink-soft">Start a conversation to arrange payment and confirm the booking details.</p>}
            {messages.map(message => <div key={message.id} className={cn("flex", message.sender === "SYSTEM" ? "justify-center" : message.mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[90%] rounded-2xl px-3.5 py-3", message.sender === "SYSTEM" ? "bg-secondary/50 text-center text-ink-soft" : message.mine ? "bg-brand-700 text-white" : "bg-mist text-ink")}><p className="mb-1 text-xs font-semibold opacity-80">{message.sender === "SYSTEM" ? "Pikol" : message.mine ? "You" : message.sender === "SELLER" ? "Seller" : "Buyer"}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.body}</p><time dateTime={message.createdAt} className="mt-2 block text-[11px] opacity-75">{messageTime(message.createdAt)}</time></div></div>)}
          </div>
          <form onSubmit={send} className="space-y-3 border-t border-line p-4 sm:p-5">
            {messageError && <PasaloError message={messageError} />}
            <Label htmlFor="pasalo-message">Message</Label><Textarea id="pasalo-message" value={draft} maxLength={1000} rows={3} placeholder="Write to the other player…" onChange={event => setDraft(event.target.value)} className="min-w-0 resize-y" aria-describedby="pasalo-message-count" />
            <div className="flex flex-wrap items-center justify-between gap-2"><span id="pasalo-message-count" className="text-xs tabular-nums text-ink-soft">{draft.length}/1000</span><Button type="submit" loading={sending} disabled={!draft.trim()}><Send className="size-4" aria-hidden />Send message</Button></div>
            <p className="text-xs text-ink-soft">Messages refresh every 5 seconds while this tab is visible.</p>
          </form>
        </Card>
      </div>}
      <Dialog open={dialog !== null} onOpenChange={open => { if (!pending && !open) setDialog(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{dialog === "transfer" ? "Confirm wallet receipt" : dialog === "release" ? "Release this reservation?" : "Mark payment as sent"}</DialogTitle><DialogDescription>{dialog === "transfer" ? "Confirm only after the correct amount has arrived in your GCash or Maya wallet. This transfers your whole booking to the buyer." : dialog === "release" ? "Release only if you have not sent any money. The offer may become available to another player." : "This tells the seller you sent money. Pikol cannot automatically verify the payment. Your reservation stays frozen until the seller confirms receipt or the booking becomes invalid."}</DialogDescription></DialogHeader>
          <form onSubmit={act} className="space-y-4">
            {actionError && <PasaloError message={actionError} />}
            {dialog === "payment" && <div className="space-y-2"><Label htmlFor="pasalo-payment-reference">Payment reference (optional)</Label><Input id="pasalo-payment-reference" value={reference} maxLength={100} onChange={event => setReference(event.target.value)} /></div>}
            <div className="flex items-start gap-3"><Checkbox id="pasalo-payment-acknowledgement" className="mt-0.5 shrink-0" checked={acknowledged} onCheckedChange={value => setAcknowledged(value === true)} /><Label htmlFor="pasalo-payment-acknowledgement" className="block text-sm leading-relaxed">{dialog === "transfer" ? "I checked my GCash or Maya wallet and received the full transfer price." : dialog === "release" ? "I have not sent any payment for this booking." : "I sent the full transfer price to the seller’s account."}</Label></div>
            <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" loading={pending} disabled={!acknowledged || (dialog === "payment" && !activeReservation)}>{dialog === "transfer" ? "Transfer booking" : dialog === "release" ? "Release without payment" : "Confirm payment sent"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PasaloShell>
  );
}
