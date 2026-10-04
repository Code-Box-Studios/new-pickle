import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import {
  seedOwnerVenueCourt,
  seedCustomer as customer,
  slot,
} from "../factories";
import { bookingBackend } from "@/lib/booking";
import {
  startCheckout,
  reconcileCheckout,
} from "@/lib/payments/paymongo/checkout";
import { settlePayment } from "@/lib/payments/paymongo/settlement";
import { merchantByAlias } from "@/lib/payments/paymongo/config";
import type { PaidEvent } from "@/lib/payments/paymongo/webhook";

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setup() {
  const s = await seedOwnerVenueCourt(),
    user = await customer();
  vi.stubEnv("PAYMONGO_ENABLED", "true");
  vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
  vi.stubEnv("PAYMONGO_MODE", "test");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv(
    "PAYMONGO_MERCHANTS",
    JSON.stringify([
      { alias: "default", ownerId: s.ownerId, venueIds: [s.venueId] },
    ]),
  );
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", "whsk_dummy");
  const b = await bookingBackend.createHold({
    ...s,
    ...slot(),
    userId: user.id,
    customer: {},
    priceCents: 40000,
  });
  await bookingBackend.submitDetails(
    b.id,
    { name: "Player" },
    { type: "CUSTOMER", id: user.id },
  );
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
  return { ...s, user, b, send };
}
async function eventFor(
  bookingId: string,
  reference: string,
): Promise<PaidEvent> {
  const attempt = await prisma.paymentCheckout.findUniqueOrThrow({
    where: { bookingId },
  });
  return {
    eventId: "evt_test123",
    sessionId: "cs_test123",
    paymentId: "pay_test123",
    attemptId: attempt.id,
    reference,
    amountCents: 40000,
    currency: "PHP",
    channel: "QRPH",
    livemode: false,
  };
}
describe("durable hosted checkout", () => {
  it("allows an owner to reschedule a confirmed paid reservation without changing its receipt", async () => {
    const { b, user, ownerId } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    await settlePayment(
      merchantByAlias("default", "test"),
      await eventFor(b.id, b.reference),
    );
    await bookingBackend.confirm(b.id, { type: "OWNER", id: ownerId });
    const moved = slot(4);
    await bookingBackend.reschedule(b.id, moved.startsAt, moved.endsAt, {
      type: "OWNER",
      id: ownerId,
    });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }),
    ).toMatchObject({
      status: "CONFIRMED",
      startsAt: moved.startsAt,
      endsAt: moved.endsAt,
    });
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("PAID");
    expect(
      (
        await prisma.paymentSubmission.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).reference,
    ).toBe("pay_test123");
  });
  it("blocks rescheduling while a hosted checkout can still accept payment", async () => {
    const { b, user, ownerId } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    const moved = slot(4);
    await expect(
      bookingBackend.reschedule(b.id, moved.startsAt, moved.endsAt, {
        type: "OWNER",
        id: ownerId,
      }),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }))
        .startsAt,
    ).toEqual(slot().startsAt);
  });
  it("does not hand out a chargeable checkout after the reservation was cancelled during creation", async () => {
    const { b, user, send } = await setup();
    send
      .mockImplementationOnce(async () => {
        await bookingBackend.cancel(b.id, { type: "CUSTOMER", id: user.id });
        return new Response(
          JSON.stringify({
            data: {
              id: "cs_test123",
              attributes: {
                checkout_url: "https://checkout.paymongo.com/cs_test123",
              },
            },
          }),
        );
      })
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: "cs_test123", attributes: { status: "expired" } },
          }),
        ),
      );
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("EXPIRED");
    expect(send.mock.calls[1][0]).toBe(
      "https://api.paymongo.com/v1/checkout_sessions/cs_test123/expire",
    );
  });
  it("preserves settlement when a webhook arrives before creation returns", async () => {
    const { b, user, send } = await setup();
    send.mockImplementationOnce(async () => {
      await settlePayment(
        merchantByAlias("default", "test"),
        await eventFor(b.id, b.reference),
      );
      return new Response(
        JSON.stringify({
          data: {
            id: "cs_test123",
            attributes: {
              checkout_url: "https://checkout.paymongo.com/cs_test123",
            },
          },
        }),
      );
    });
    expect(await startCheckout(b.id, user.id, "CUSTOMER")).toMatchObject({
      next: `/bookings/${b.reference}`,
    });
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("PAID");
  });
  it("reuses a server-priced checkout instead of creating another chargeable session", async () => {
    const { b, user, send } = await setup();
    expect(await startCheckout(b.id, user.id, "CUSTOMER")).toMatchObject({
      checkoutUrl: "https://checkout.paymongo.com/cs_test123",
    });
    expect(await startCheckout(b.id, user.id, "CUSTOMER")).toMatchObject({
      checkoutUrl: "https://checkout.paymongo.com/cs_test123",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).amountCents,
    ).toBe(40000);
  });
  it("blocks a competing click while the provider request is in progress", async () => {
    const { b, user, send } = await setup();
    let finish!: (response: Response) => void, started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    send.mockImplementation(() => {
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const first = startCheckout(b.id, user.id, "CUSTOMER");
    await startedPromise;
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 409 });
    finish(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_test123",
            attributes: {
              checkout_url: "https://checkout.paymongo.com/cs_test123",
            },
          },
        }),
      ),
    );
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign users, unfinished details and expired holds before any provider call", async () => {
    const { b, user, send } = await setup();
    await expect(
      startCheckout(b.id, "stranger", "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 403 });
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: "HELD" },
    });
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 409 });
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: "PENDING_PAYMENT",
        holdExpiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 410 });
    expect(send).not.toHaveBeenCalled();
  });
  it("quarantines a lost provider response and never retries a possibly created checkout", async () => {
    const { b, user, send } = await setup();
    send.mockRejectedValue(new Error("network interrupted"));
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 502 });
    await expect(
      startCheckout(b.id, user.id, "CUSTOMER"),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("REVIEW");
    // A valid webhook can recover the session even though creation never returned its ID.
    await settlePayment(
      merchantByAlias("default", "test"),
      await eventFor(b.id, b.reference),
    );
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe("PENDING_CONFIRMATION");
  });
  it("blocks manual proof submission while a hosted checkout could still be paid", async () => {
    const { b, user } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    await expect(
      bookingBackend.submitPayment(
        b.id,
        {
          channel: "GCASH",
          reference: "manual",
          proofKey: "payment-proofs/x.png",
          amountCents: 40000,
        },
        { type: "CUSTOMER" },
      ),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(await prisma.paymentSubmission.count()).toBe(0);
  });
});
describe("verified settlement", () => {
  it("settles duplicate deliveries once, creates a real receipt and leaves venue confirmation pending", async () => {
    const { b, user } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    const event = await eventFor(b.id, b.reference),
      merchant = merchantByAlias("default", "test");
    await Promise.all([
      settlePayment(merchant, event),
      settlePayment(merchant, event),
    ]);
    await settlePayment(merchant, { ...event, eventId: "evt_another" });
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }),
    ).toMatchObject({ status: "PENDING_CONFIRMATION", holdExpiresAt: null });
    expect(
      await prisma.paymentSubmission.findUniqueOrThrow({
        where: { bookingId: b.id },
      }),
    ).toMatchObject({
      channel: "QRPH",
      proofKey: null,
      amountCents: 40000,
      reference: "pay_test123",
    });
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: b.id, toStatus: "PAYMENT_SUBMITTED" },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.paymentCheckout.findUniqueOrThrow({
          where: { bookingId: b.id },
        })
      ).status,
    ).toBe("PAID");
  });
  it.each([
    "amount",
    "currency",
    "reference",
    "owner",
    "session",
    "mode",
    "method",
  ])(
    "holds a %s mismatch for review without confirming payment",
    async (mismatch) => {
      const { b, user, venueId } = await setup();
      await startCheckout(b.id, user.id, "CUSTOMER");
      const event = await eventFor(b.id, b.reference);
      if (mismatch === "amount") event.amountCents = 1;
      if (mismatch === "currency") event.currency = "USD";
      if (mismatch === "reference") event.reference = "another";
      if (mismatch === "owner") {
        const other = await customer();
        await prisma.venue.update({
          where: { id: venueId },
          data: { ownerId: other.id },
        });
      }
      if (mismatch === "session") event.sessionId = "cs_other";
      if (mismatch === "mode") event.livemode = true;
      if (mismatch === "method")
        vi.stubEnv(
          "PAYMONGO_MERCHANTS",
          JSON.stringify([
            {
              alias: "default",
              ownerId: (
                await prisma.venue.findUniqueOrThrow({ where: { id: venueId } })
              ).ownerId,
              venueIds: [venueId],
              methods: ["gcash"],
            },
          ]),
        );
      await settlePayment(merchantByAlias("default", "test"), event);
      expect(
        (
          await prisma.paymentCheckout.findUniqueOrThrow({
            where: { bookingId: b.id },
          })
        ).status,
      ).toBe("REVIEW");
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }))
          .status,
      ).toBe("PENDING_PAYMENT");
      expect(await prisma.paymentSubmission.count()).toBe(0);
    },
  );
  it.each(["expired", "cancelled"])(
    "never revives a %s slot after money arrives",
    async (state) => {
      const { b, user, venueId, courtId } = await setup();
      await startCheckout(b.id, user.id, "CUSTOMER");
      if (state === "expired")
        await prisma.booking.update({
          where: { id: b.id },
          data: { holdExpiresAt: new Date(Date.now() - 1000) },
        });
      else await bookingBackend.cancel(b.id, { type: "CUSTOMER", id: user.id });
      const replacement = await bookingBackend.createHold({
        venueId,
        courtId,
        ...slot(),
        priceCents: 40000,
        customer: {},
      });
      await settlePayment(
        merchantByAlias("default", "test"),
        await eventFor(b.id, b.reference),
      );
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }))
          .status,
      ).toBe(state === "expired" ? "EXPIRED" : "CANCELLED");
      expect(
        (
          await prisma.booking.findUniqueOrThrow({
            where: { id: replacement.id },
          })
        ).status,
      ).toBe("HELD");
      expect(
        (
          await prisma.paymentCheckout.findUniqueOrThrow({
            where: { bookingId: b.id },
          })
        ).status,
      ).toBe("REVIEW");
    },
  );
  it("does not expire a payment settled after the expiry worker's stale snapshot", async () => {
    const { b, user } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    const event = await eventFor(b.id, b.reference);
    const stale = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
    });
    await settlePayment(merchantByAlias("default", "test"), event);
    vi.spyOn(prisma.booking, "findMany").mockResolvedValueOnce([stale]);
    const count = await bookingBackend.expireStale(
      new Date(Date.now() + 20 * 60_000),
    );
    expect(count).toBe(0);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe("PENDING_CONFIRMATION");
  });
  it("checks the provider server instead of trusting a success return", async () => {
    const { b, user, send } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    send.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_test123",
            attributes: { status: "active", livemode: false, payments: [] },
          },
        }),
      ),
    );
    expect((await reconcileCheckout(b.id))?.status).toBe("PENDING");
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe("PENDING_PAYMENT");
  });
  it("quarantines an unrecognized paid provider response instead of permitting another payment", async () => {
    const { b, user, send } = await setup();
    await startCheckout(b.id, user.id, "CUSTOMER");
    send.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_test123",
            attributes: {
              status: "active",
              livemode: false,
              payments: [
                {
                  id: "pay_test123",
                  attributes: {
                    status: "paid",
                    amount: 40000,
                    currency: "PHP",
                    source: { type: "unexpected_wallet" },
                  },
                },
              ],
            },
          },
        }),
      ),
    );
    expect((await reconcileCheckout(b.id))?.status).toBe("REVIEW");
    expect(await prisma.paymentSubmission.count()).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
