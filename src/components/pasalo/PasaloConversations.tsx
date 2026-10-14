"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PasaloTradeView } from "@/lib/pasalo/types";
import { pasaloRequest } from "./pasalo-client";
import { PasaloError, PasaloStatus } from "./PasaloShared";

export function PasaloConversations({ listingId, conversations, hasOlder }: { listingId: string; conversations: PasaloTradeView[]; hasOlder: boolean }) {
  const [older, setOlder] = useState<PasaloTradeView[]>([]);
  const [more, setMore] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = [...conversations, ...older.filter(t => !conversations.some(c => c.id === t.id))];
  async function load() {
    if (pending || !all.length) return;
    setPending(true); setError(null);
    try {
      const next = await pasaloRequest<{ conversations: PasaloTradeView[]; hasOlder: boolean }>(`/api/pasalo/${listingId}/conversations?before=${all[all.length - 1].id}`);
      setOlder(previous => [...previous, ...next.conversations.filter(t => !previous.some(p => p.id === t.id))]); setMore(next.hasOlder);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load earlier conversations."); }
    finally { setPending(false); }
  }
  if (!all.length) return null;
  return <div className="space-y-2 border-t border-line pt-4"><h3 className="text-sm font-semibold">Buyer conversations</h3>{all.map(t => <Button key={t.id} asChild variant="ghost" className="h-auto min-h-11 w-full justify-between gap-2 whitespace-normal px-2"><Link href={`/pasalo/trades/${t.id}`}><span className="min-w-0 break-words text-left">{t.customerName}</span><PasaloStatus status={t.status} /></Link></Button>)}{error && <PasaloError message={error} />}{(more ?? hasOlder) && <Button variant="outline" loading={pending} onClick={() => void load()}>Earlier conversations</Button>}</div>;
}
