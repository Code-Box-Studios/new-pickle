"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { channelLabel } from "@/lib/payment";
import { sendJson } from "./api";
import type { PaymentChannel } from "@/generated/prisma";

export interface MethodDTO {
  id: string;
  channel: PaymentChannel;
  accountName: string;
  accountNumber: string;
  instructions: string | null;
  active: boolean;
}

const CHANNELS: PaymentChannel[] = ["GCASH", "MAYA", "BANK_TRANSFER", "CASH"];

export function PaymentMethodEditor({
  venueId,
  methods,
  locked,
}: {
  venueId: string;
  methods: MethodDTO[];
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState({ channel: "GCASH" as PaymentChannel, accountName: "", accountNumber: "", instructions: "" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setAdding(false);
      setDraft({ channel: "GCASH", accountName: "", accountNumber: "", instructions: "" });
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3">
            <div>
              <p className="font-medium text-ink">{channelLabel(m.channel)}</p>
              <p className="text-xs text-muted">{m.accountName} · {m.accountNumber}</p>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={() => run(() => sendJson(`/api/owner/venues/${venueId}/payment-methods/${m.id}`, "DELETE"))}
                className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                aria-label="Remove method"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
        {methods.length === 0 && <li className="text-sm text-muted">No payment methods yet.</li>}
      </ul>

      {!locked &&
        (adding ? (
          <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <Field label="Channel" htmlFor="pmch">
              <Select id="pmch" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as PaymentChannel })}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{channelLabel(c)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Account name" htmlFor="pmname">
              <Input id="pmname" value={draft.accountName} onChange={(e) => setDraft({ ...draft, accountName: e.target.value })} />
            </Field>
            <Field label="Account number" htmlFor="pmnum">
              <Input id="pmnum" value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} />
            </Field>
            <Field label="Instructions (optional)" htmlFor="pmnote">
              <Input id="pmnote" value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" loading={busy} onClick={() => run(() => sendJson(`/api/owner/venues/${venueId}/payment-methods`, "POST", draft))}>
                Add method
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add payment method
          </Button>
        ))}

      {!locked && (
        <Button size="lg" block onClick={() => { router.push(`/owner/venues/${venueId}/review`); router.refresh(); }}>
          Continue to review
        </Button>
      )}
    </div>
  );
}
