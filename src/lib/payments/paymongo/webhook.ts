import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/booking/errors";
import type { Merchant } from "./config";
import type { CheckoutSession } from "./client";

export interface PaidEvent {
  eventId: string;
  sessionId: string;
  paymentId: string;
  attemptId: string;
  reference: string;
  amountCents: number;
  currency: string;
  livemode: boolean;
  channel: "GCASH" | "MAYA" | "QRPH";
}
function invalidSignature(): never {
  throw new AppError("Invalid webhook signature", 401, "invalid_signature");
}
export function verifyWebhook(
  raw: Buffer,
  header: string | null,
  merchant: Merchant,
  now = Date.now(),
) {
  if (!header || header.length > 512) invalidSignature();
  const fields: Record<string, string> = {};
  for (const segment of header.split(",")) {
    const pair = segment.trim().split("=");
    if (
      pair.length !== 2 ||
      !["t", "te", "li"].includes(pair[0]) ||
      pair[0] in fields
    )
      invalidSignature();
    fields[pair[0]] = pair[1];
  }
  if (
    !/^\d{10}$/.test(fields.t ?? "") ||
    Math.abs(now / 1000 - Number(fields.t)) > 300
  )
    invalidSignature();
  const provided = fields[merchant.mode === "test" ? "te" : "li"];
  if (!/^[a-fA-F0-9]{64}$/.test(provided ?? "")) invalidSignature();
  const expected = createHmac("sha256", merchant.webhookSecret)
    .update(fields.t + ".")
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(provided, "hex")))
    invalidSignature();
}
type ObjectValue = Record<string, unknown>;
function obj(value: unknown): ObjectValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : {};
}
/** Only normalized identifiers and amounts leave the provider boundary, never billing data. */
export function paidFromSession(
  session: CheckoutSession,
  livemode: boolean,
  eventId?: string,
): PaidEvent | null {
  const a = obj(session.attributes),
    metadata = obj(a.metadata);
  const payments = Array.isArray(a.payments) ? a.payments : [];
  const paid = payments.filter(
    (payment) => obj(obj(payment).attributes).status === "paid",
  );
  if (paid.length !== 1) return null;
  const payment = obj(paid[0]),
    p = obj(payment.attributes),
    source = obj(p.source);
  const channels = { gcash: "GCASH", paymaya: "MAYA", qrph: "QRPH" } as const;
  const channel = channels[source.type as keyof typeof channels];
  if (
    !channel ||
    typeof payment.id !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(payment.id) ||
    !/^cs_[A-Za-z0-9]+$/.test(session.id) ||
    typeof metadata.pikol_checkout_id !== "string" ||
    typeof a.reference_number !== "string" ||
    !Number.isSafeInteger(p.amount) ||
    Number(p.amount) <= 0 ||
    typeof p.currency !== "string" ||
    (typeof p.livemode === "boolean" && p.livemode !== livemode) ||
    (typeof a.livemode === "boolean" && a.livemode !== livemode)
  )
    return null;
  return {
    eventId: eventId ?? `checkout:${session.id}:${payment.id}`,
    sessionId: session.id,
    paymentId: payment.id,
    attemptId: metadata.pikol_checkout_id,
    reference: a.reference_number,
    amountCents: Number(p.amount),
    currency: p.currency,
    livemode,
    channel,
  };
}
export function parsePaidEvent(payload: unknown): PaidEvent | null {
  const root = obj(payload),
    data = obj(root.data);
  const envelope = data.type === "event" ? obj(data.attributes) : data;
  if (
    envelope.type !== "checkout_session.payment.paid" ||
    typeof envelope.livemode !== "boolean"
  )
    return null;
  const session = obj(envelope.data);
  if (session.type !== "checkout_session" || typeof session.id !== "string")
    return null;
  return paidFromSession(
    { id: session.id, attributes: obj(session.attributes) },
    envelope.livemode,
    data.type === "event" && typeof data.id === "string" ? data.id : undefined,
  );
}
