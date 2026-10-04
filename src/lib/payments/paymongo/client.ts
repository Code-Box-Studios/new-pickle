import "server-only";
import { AppError } from "@/lib/booking/errors";
import { appOrigin, type Merchant } from "./config";

export class ProviderError extends AppError {
  constructor(public readonly definitive = false) {
    super(
      "We could not confirm the payment provider response. Please check your booking before trying again.",
      502,
      "payment_provider_unavailable",
    );
  }
}
export interface CheckoutSession {
  id: string;
  type?: string;
  attributes: Record<string, unknown>;
}
async function request(
  merchant: Merchant,
  path: string,
  body?: unknown,
): Promise<CheckoutSession> {
  try {
    const response = await fetch(`https://api.paymongo.com${path}`, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Basic ${Buffer.from(merchant.secretKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new ProviderError(
        [400, 401, 403, 404, 422].includes(response.status),
      );
    const result = await response.json();
    const data = result?.data;
    if (
      !data ||
      typeof data.id !== "string" ||
      !/^cs_[A-Za-z0-9]+$/.test(data.id) ||
      !data.attributes ||
      typeof data.attributes !== "object" ||
      Array.isArray(data.attributes) ||
      (typeof data.attributes.livemode === "boolean" &&
        data.attributes.livemode !== (merchant.mode === "live"))
    )
      throw new ProviderError();
    return data;
  } catch (error) {
    throw error instanceof ProviderError ? error : new ProviderError();
  }
}
export async function createCheckout(
  merchant: Merchant,
  input: {
    attemptId: string;
    reference: string;
    amountCents: number;
    venueName: string;
  },
) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 100)
    throw new ProviderError(true);
  const origin = appOrigin(),
    reference = encodeURIComponent(input.reference);
  const session = await request(merchant, "/v2/checkout_sessions", {
    data: {
      attributes: {
        line_items: [
          {
            amount: input.amountCents,
            currency: "PHP",
            quantity: 1,
            name: `Court booking · ${input.venueName.slice(0, 100)}`,
          },
        ],
        payment_method_types: merchant.methods,
        reference_number: input.reference,
        metadata: { pikol_checkout_id: input.attemptId },
        description: `Pikol booking ${input.reference}`,
        success_url: `${origin}/bookings/${reference}?payment=return`,
        cancel_url: `${origin}/book/${reference}?payment=cancelled`,
        pass_on_fees: false,
        show_line_items: true,
        send_email_receipt: true,
      },
    },
  });
  let url: URL;
  try {
    url = new URL(String(session.attributes.checkout_url));
  } catch {
    throw new ProviderError();
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.paymongo.com" ||
    url.port ||
    url.username ||
    url.password
  )
    throw new ProviderError();
  return { sessionId: session.id, checkoutUrl: url.toString() };
}
function sessionPath(id: string) {
  if (!/^cs_[A-Za-z0-9]+$/.test(id)) throw new ProviderError(true);
  return `/v1/checkout_sessions/${id}`;
}
export function getCheckout(merchant: Merchant, id: string) {
  return request(merchant, sessionPath(id));
}
export function expireCheckout(merchant: Merchant, id: string) {
  return request(merchant, `${sessionPath(id)}/expire`, {});
}
