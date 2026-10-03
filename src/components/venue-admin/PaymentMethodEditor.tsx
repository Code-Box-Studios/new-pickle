"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { channelLabel } from "@/lib/payment";
import { sendJson } from "./api";
import type { PaymentChannel } from "@/generated/prisma";
import { SetupActions } from "./SetupActions";

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
  const [draft, setDraft] = useState({
    channel: "GCASH" as PaymentChannel,
    accountName: "",
    accountNumber: "",
    instructions: "",
  });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setAdding(false);
      setDraft({
        channel: "GCASH",
        accountName: "",
        accountNumber: "",
        instructions: "",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: (err as Error).message,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-brand-200/60 bg-mist/40 p-4">
        <Wallet className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
        <p className="text-sm leading-relaxed text-ink-soft">
          Payments go directly to your venue. Add the methods you accept and
          instructions players should follow.
        </p>
      </div>
      <ul className="space-y-2">
        {methods.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas/60 p-4 sm:p-5"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{channelLabel(m.channel)}</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {m.accountName} · {m.accountNumber}
              </p>
            </div>
            {!locked && (
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  run(() =>
                    sendJson(
                      `/api/owner/venues/${venueId}/payment-methods/${m.id}`,
                      "DELETE",
                    ),
                  )
                }
                className="size-11 shrink-0 p-0 text-red-600 hover:bg-red-50"
                aria-label="Remove method"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
        {methods.length === 0 && (
          <li className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
            <p className="font-medium text-ink">Give players a way to pay.</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Add GCash, Maya, a bank account, or cash at the venue.
            </p>
          </li>
        )}
      </ul>

      {!locked &&
        (adding ? (
          <Card className="space-y-5 border-brand-200 bg-mist/30 p-5">
            <h3 className="font-semibold text-ink">Add a payment method</h3>
            <Field label="Channel" htmlFor="pmch">
              <SelectField
                id="pmch"
                value={draft.channel}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    channel: value as PaymentChannel,
                  })
                }
              >
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    {channelLabel(c)}
                  </SelectItem>
                ))}
              </SelectField>
            </Field>
            <Field label="Account name" htmlFor="pmname">
              <Input
                id="pmname"
                value={draft.accountName}
                onChange={(e) =>
                  setDraft({ ...draft, accountName: e.target.value })
                }
              />
            </Field>
            <Field label="Account number" htmlFor="pmnum">
              <Input
                id="pmnum"
                value={draft.accountNumber}
                onChange={(e) =>
                  setDraft({ ...draft, accountNumber: e.target.value })
                }
              />
            </Field>
            <Field label="Instructions (optional)" htmlFor="pmnote">
              <Input
                id="pmnote"
                value={draft.instructions}
                onChange={(e) =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy}
                onClick={() =>
                  run(() =>
                    sendJson(
                      `/api/owner/venues/${venueId}/payment-methods`,
                      "POST",
                      draft,
                    ),
                  )
                }
              >
                Add method
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add payment method
          </Button>
        ))}

      {!locked && (
        <SetupActions
          venueId={venueId}
          back="hours"
          label="Continue to review"
          disabled={busy}
          onContinue={() => {
            router.push(`/owner/venues/${venueId}/review`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
