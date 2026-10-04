import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot, seedCustomer } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { POST as checkout } from "@/app/api/bookings/[id]/checkout/route";
import { POST as status } from "@/app/api/bookings/[id]/checkout/status/route";
import { POST as webhook } from "@/app/api/webhooks/paymongo/[merchant]/[mode]/route";
import { GET as scheduled } from "@/app/api/payments/paymongo/reconcile/route";
import { startCheckout } from "@/lib/payments/paymongo/checkout";
const auth = vi.hoisted(() => ({
  session: null as null | { id: string; role: "CUSTOMER" },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => auth.session }));
beforeEach(async () => {
  await resetDb();
  auth.session = null;
  vi.stubEnv("PAYMONGO_ENABLED", "false");
  vi.stubEnv("PAYMONGO_LEDGER_READY", "false");
  vi.stubEnv("APP_PREVIEW_MODE", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (
  path: string,
  origin: string | null = "http://localhost:3000",
) =>
  new NextRequest("http://localhost:3000" + path, {
    method: "POST",
    headers: origin ? { origin } : {},
  });
async function setup() {
  const s = await seedOneCourtSlot(),
    user = await seedCustomer();
  auth.session = { id: user.id, role: "CUSTOMER" };
  const b = await bookingBackend.createHold({
    ...s,
    userId: user.id,
    customer: {},
  });
  await bookingBackend.submitDetails(
    b.id,
    { name: "Player" },
    { type: "CUSTOMER" },
  );
  return { ...s, b, user, params: { params: Promise.resolve({ id: b.id }) } };
}
describe("PayMongo route boundaries", () => {
  it("recovers a paid session while its hold is still valid when the webhook and customer page are absent", async () => {
    const { b, ownerId, venueId, user } = await setup();
    vi.stubEnv("CRON_SECRET", "private-test-cron-key-at-least-32-characters");
    vi.stubEnv("PAYMONGO_ENABLED", "true");
    vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
    vi.stubEnv("PAYMONGO_MODE", "test");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv(
      "PAYMONGO_MERCHANTS",
      JSON.stringify([{ alias: "default", ownerId, venueIds: [venueId] }]),
    );
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", "whsk_dummy");
    const send = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "cs_recovery",
              attributes: {
                checkout_url: "https://checkout.paymongo.com/cs_recovery",
              },
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", send);
    await startCheckout(b.id, user.id, "CUSTOMER");
    const attempt = await prisma.paymentCheckout.findUniqueOrThrow({
      where: { bookingId: b.id },
    });
    send.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_recovery",
            attributes: {
              status: "active",
              livemode: false,
              reference_number: b.reference,
              metadata: { pikol_checkout_id: attempt.id },
              payments: [
                {
                  id: "pay_recovery",
                  attributes: {
                    status: "paid",
                    amount: 40000,
                    currency: "PHP",
                    livemode: false,
                    source: { type: "qrph" },
                  },
                },
              ],
            },
          },
        }),
      ),
    );
    const response = await scheduled(
      new NextRequest("http://localhost:3000/api/payments/paymongo/reconcile", {
        headers: {
          authorization: "Bearer private-test-cron-key-at-least-32-characters",
        },
      }),
    );
    expect(await response.json()).toMatchObject({ checked: 1, failed: 0 });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe("PENDING_CONFIRMATION");
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("PAID");
  });
  it("never lets anonymous requests run the scheduled reconciliation job", async () => {
    vi.stubEnv("CRON_SECRET", "private-test-cron-key-at-least-32-characters");
    expect(
      (
        await scheduled(
          new NextRequest(
            "http://localhost:3000/api/payments/paymongo/reconcile",
          ),
        )
      ).status,
    ).toBe(401);
    const req = new NextRequest(
      "http://localhost:3000/api/payments/paymongo/reconcile",
      {
        headers: {
          authorization: "Bearer private-test-cron-key-at-least-32-characters",
        },
      },
    );
    expect(await (await scheduled(req)).json()).toMatchObject({
      disabled: true,
    });
  });
  it("requires a session and ownership for checkout and private receipt status", async () => {
    const s = await setup();
    auth.session = null;
    expect(
      (await checkout(request("/api/bookings/x/checkout"), s.params)).status,
    ).toBe(401);
    auth.session = { id: "another-player", role: "CUSTOMER" };
    expect(
      (await status(request("/api/bookings/x/checkout/status"), s.params))
        .status,
    ).toBe(403);
    expect(
      (await checkout(request("/api/bookings/x/checkout"), s.params)).status,
    ).toBe(403);
  });
  it("requires the site's browser Origin before starting or reconciling payments", async () => {
    const s = await setup();
    expect(
      (
        await checkout(
          request("/api/bookings/x/checkout", "https://foreign.example"),
          s.params,
        )
      ).status,
    ).toBe(403);
    expect(
      (await status(request("/api/bookings/x/checkout/status", null), s.params))
        .status,
    ).toBe(403);
  });
  it("can deploy disabled without touching unmigrated ledger tables", async () => {
    const s = await setup();
    const spy = vi.spyOn(prisma.paymentCheckout, "findUnique");
    expect(
      (await checkout(request("/api/bookings/x/checkout"), s.params)).status,
    ).toBe(503);
    expect(
      await (
        await status(request("/api/bookings/x/checkout/status"), s.params)
      ).json(),
    ).toEqual({ checkout: null });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("rejects oversized webhook bodies before parsing or verification", async () => {
    vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
    vi.stubEnv("PAYMONGO_MODE", "test");
    vi.stubEnv(
      "PAYMONGO_MERCHANTS",
      '[{"alias":"default","ownerId":"owner","venueIds":["venue"]}]',
    );
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", "whsk_dummy");
    const req = new NextRequest(
      "http://localhost:3000/api/webhooks/paymongo/default/test",
      { method: "POST", body: "x".repeat(65537) },
    );
    expect(
      (
        await webhook(req, {
          params: Promise.resolve({ merchant: "default", mode: "test" }),
        })
      ).status,
    ).toBe(413);
  });
  it("accepts correctly signed unrelated events but rejects altered raw payloads", async () => {
    vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
    vi.stubEnv("PAYMONGO_MODE", "test");
    vi.stubEnv(
      "PAYMONGO_MERCHANTS",
      '[{"alias":"default","ownerId":"owner","venueIds":["venue"]}]',
    );
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", "whsk_dummy");
    const raw =
        '{"data":{"type":"event","attributes":{"type":"payment.failed"}}}',
      t = Math.floor(Date.now() / 1000);
    const signature = `t=${t},te=${createHmac("sha256", "whsk_dummy").update(`${t}.${raw}`).digest("hex")},li=`;
    const send = (body: string) =>
      new NextRequest(
        "http://localhost:3000/api/webhooks/paymongo/default/test",
        { method: "POST", body, headers: { "Paymongo-Signature": signature } },
      );
    const params = {
      params: Promise.resolve({ merchant: "default", mode: "test" }),
    };
    expect((await webhook(send(raw), params)).status).toBe(200);
    expect((await webhook(send(raw + " "), params)).status).toBe(401);
  });
});
