import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  merchantForVenue,
  merchantByAlias,
} from "@/lib/payments/paymongo/config";
import { createCheckout, getCheckout } from "@/lib/payments/paymongo/client";
import { verifyWebhook, parsePaidEvent } from "@/lib/payments/paymongo/webhook";

const merchant = {
  alias: "default",
  ownerId: "owner",
  venueIds: ["venue"],
  mode: "test" as const,
  methods: ["gcash", "paymaya", "qrph"] as const,
  secretKey: "sk_test_private_dummy_key",
  webhookSecret: "whsk_private_dummy_secret",
};
function configured() {
  vi.stubEnv("PAYMONGO_ENABLED", "true");
  vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
  vi.stubEnv("PAYMONGO_MODE", "test");
  vi.stubEnv(
    "PAYMONGO_MERCHANTS",
    JSON.stringify([
      {
        alias: "default",
        ownerId: "owner",
        venueIds: ["venue"],
        methods: merchant.methods,
      },
    ]),
  );
  vi.stubEnv("PAYMONGO_SECRET_KEY", merchant.secretKey);
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", merchant.webhookSecret);
  vi.stubEnv("APP_URL", "http://localhost:3000");
}
const attributes = {
  reference_number: "BOOK123",
  metadata: { pikol_checkout_id: "attempt" },
  payments: [
    {
      id: "pay_test123",
      type: "payment",
      attributes: {
        status: "paid",
        amount: 40000,
        currency: "PHP",
        livemode: false,
        source: { type: "qrph" },
      },
    },
  ],
};
const legacy = {
  data: {
    id: "evt_test123",
    type: "event",
    attributes: {
      type: "checkout_session.payment.paid",
      livemode: false,
      data: { id: "cs_test123", type: "checkout_session", attributes },
    },
  },
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PayMongo merchant routing", () => {
  it("keeps checkout disabled by default and requires applied ledger readiness", () => {
    vi.stubEnv("PAYMONGO_ENABLED", "false");
    expect(merchantForVenue("venue", "owner")).toBeNull();
    configured();
    vi.stubEnv("PAYMONGO_LEDGER_READY", "false");
    expect(merchantForVenue("venue", "owner")).toBeNull();
  });
  it("links only configured venues belonging to the approved merchant owner", () => {
    configured();
    expect(merchantForVenue("venue", "owner")?.alias).toBe("default");
    expect(merchantForVenue("other-venue", "owner")).toBeNull();
    expect(merchantForVenue("venue", "other-owner")).toBeNull();
  });
  it("does not turn off settlement credentials when creation is disabled", () => {
    configured();
    vi.stubEnv("PAYMONGO_ENABLED", "false");
    expect(merchantByAlias("default", "test").secretKey).toBe(
      merchant.secretKey,
    );
  });
  it("fails closed for a key from the wrong mode or overlapping venue mappings", () => {
    configured();
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_live_private_dummy_key");
    expect(() => merchantByAlias("default", "test")).toThrow();
    configured();
    vi.stubEnv(
      "PAYMONGO_MERCHANTS",
      JSON.stringify([
        { alias: "default", ownerId: "owner", venueIds: ["venue"] },
        { alias: "second", ownerId: "owner", venueIds: ["venue"] },
      ]),
    );
    expect(() => merchantForVenue("venue", "owner")).toThrow();
  });
});
describe("hosted checkout provider boundary", () => {
  it("uses v2 creation, PHP server amount, merchant credentials and canonical return URLs", async () => {
    configured();
    const send = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_test123",
            type: "checkout_session",
            attributes: {
              checkout_url: "https://checkout.paymongo.com/cs_test123",
              livemode: false,
            },
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", send);
    const result = await createCheckout(merchant, {
      attemptId: "attempt",
      reference: "BOOK123",
      amountCents: 40000,
      venueName: "The venue",
    });
    expect(result.checkoutUrl).toBe("https://checkout.paymongo.com/cs_test123");
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.paymongo.com/v2/checkout_sessions");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from(merchant.secretKey + ":").toString("base64")}`,
    );
    const body = JSON.parse(init.body).data.attributes;
    expect(body).toMatchObject({
      line_items: [{ amount: 40000, currency: "PHP", quantity: 1 }],
      payment_method_types: ["gcash", "paymaya", "qrph"],
      pass_on_fees: false,
      reference_number: "BOOK123",
      metadata: { pikol_checkout_id: "attempt" },
    });
    expect(body.success_url).toBe(
      "http://localhost:3000/bookings/BOOK123?payment=return",
    );
    expect(body.cancel_url).toBe(
      "http://localhost:3000/book/BOOK123?payment=cancelled",
    );
  });
  it.each([
    "https://evil.test/charge",
    "http://checkout.paymongo.com/pay",
    "https://checkout.paymongo.com.evil.test/pay",
  ])("rejects unsafe provider URL %s", async (checkout_url) => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: "cs_test123",
              type: "checkout_session",
              attributes: { checkout_url, livemode: false },
            },
          }),
        ),
      ),
    );
    await expect(
      createCheckout(merchant, {
        attemptId: "a",
        reference: "R",
        amountCents: 40000,
        venueName: "Venue",
      }),
    ).rejects.toMatchObject({ httpStatus: 502 });
  });
  it("never echoes provider errors or automatically retries creation", async () => {
    configured();
    const send = vi.fn().mockRejectedValue(new Error("private key detail"));
    vi.stubGlobal("fetch", send);
    await expect(
      createCheckout(merchant, {
        attemptId: "a",
        reference: "R",
        amountCents: 40000,
        venueName: "Venue",
      }),
    ).rejects.toMatchObject({ code: "payment_provider_unavailable" });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("retrieves stored session IDs with v1 without following redirects", async () => {
    const send = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "cs_test123", type: "checkout_session", attributes },
        }),
      ),
    );
    vi.stubGlobal("fetch", send);
    expect((await getCheckout(merchant, "cs_test123")).id).toBe("cs_test123");
    expect(send.mock.calls[0][0]).toBe(
      "https://api.paymongo.com/v1/checkout_sessions/cs_test123",
    );
    expect(send.mock.calls[0][1].redirect).toBe("error");
  });
});
describe("verified payment events", () => {
  it("checks raw bytes and the correct test/live signature", () => {
    const raw = Buffer.from(JSON.stringify(legacy));
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", merchant.webhookSecret)
      .update(timestamp + ".")
      .update(raw)
      .digest("hex");
    expect(() =>
      verifyWebhook(raw, `t=${timestamp},te=${sig},li=`, merchant),
    ).not.toThrow();
    expect(() =>
      verifyWebhook(
        Buffer.concat([raw, Buffer.from(" ")]),
        `t=${timestamp},te=${sig},li=`,
        merchant,
      ),
    ).toThrow();
    expect(() =>
      verifyWebhook(raw, `t=${timestamp},te=,li=${sig}`, merchant),
    ).toThrow();
  });
  it("rejects malformed, repeated and stale signature fields", () => {
    const raw = Buffer.from("{}");
    expect(() => verifyWebhook(raw, "t=1,te=broken", merchant)).toThrow();
    const old = Math.floor(Date.now() / 1000) - 301;
    const sig = createHmac("sha256", merchant.webhookSecret)
      .update(old + ".")
      .update(raw)
      .digest("hex");
    expect(() =>
      verifyWebhook(raw, `t=${old},te=${sig},li=`, merchant),
    ).toThrow();
    expect(() =>
      verifyWebhook(raw, `t=${old},t=${old},te=${sig},li=`, merchant),
    ).toThrow();
  });
  it("normalizes both documented envelopes and ignores unrelated events", () => {
    expect(parsePaidEvent(legacy)).toMatchObject({
      eventId: "evt_test123",
      sessionId: "cs_test123",
      paymentId: "pay_test123",
      attemptId: "attempt",
      reference: "BOOK123",
      amountCents: 40000,
      channel: "QRPH",
      livemode: false,
    });
    const modern = {
      event_type: "send.webhook",
      data: {
        type: "checkout_session.payment.paid",
        resource: "checkout_session",
        livemode: false,
        data: { id: "cs_test123", type: "checkout_session", attributes },
      },
    };
    expect(parsePaidEvent(modern)?.eventId).toBe(
      "checkout:cs_test123:pay_test123",
    );
    expect(
      parsePaidEvent({ data: { attributes: { type: "payment.failed" } } }),
    ).toBeNull();
  });
});
