import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
beforeEach(resetDb);
describe("private provider payment ledger", () => {
  it("hides checkout URLs and receipts even when an untrusted role receives SELECT", async () => {
    const s = await seedOneCourtSlot(),
      b = await bookingBackend.createHold({ ...s, customer: {} });
    const checkout = await prisma.paymentCheckout.create({
      data: {
        bookingId: b.id,
        merchantAlias: "fixture",
        mode: "test",
        recipientOwnerId: s.ownerId,
        amountCents: 40000,
        holdExpiresAt: b.holdExpiresAt!,
        checkoutUrl: "https://checkout.paymongo.com/private",
      },
    });
    await prisma.paymentWebhookReceipt.create({
      data: {
        merchantAlias: "fixture",
        mode: "test",
        eventId: "evt_private",
        paymentId: "pay_private",
        sessionId: "cs_private",
        checkoutId: checkout.id,
        amountCents: 40000,
        currency: "PHP",
        channel: "QRPH",
        outcome: "REVIEW",
      },
    });
    const role = `pikol_pay_test_${randomUUID().replaceAll("-", "")}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN NOBYPASSRLS`);
      await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await tx.$executeRawUnsafe(
        `GRANT SELECT ON public.payment_checkouts, public.payment_webhook_receipts TO "${role}"`,
      );
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      expect(
        await tx.$queryRaw`SELECT * FROM public.payment_checkouts`,
      ).toEqual([]);
      expect(
        await tx.$queryRaw`SELECT * FROM public.payment_webhook_receipts`,
      ).toEqual([]);
      await tx.$executeRawUnsafe("RESET ROLE");
      await tx.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
      await tx.$executeRawUnsafe(`DROP ROLE "${role}"`);
    });
    expect(await prisma.paymentCheckout.count()).toBe(1);
  });
});
