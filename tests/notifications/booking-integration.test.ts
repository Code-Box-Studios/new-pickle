import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { notificationService } from "@/lib/notifications/service";
import { newReference } from "@/lib/booking/reference";

beforeEach(resetDb);

async function setup() {
  const base = await seedOwnerVenueCourt();
  const customer = await prisma.user.create({
    data: { email: `c-${randomUUID().slice(0, 8)}@t.test`, role: "CUSTOMER" },
  });
  return { ...base, customer };
}

function count(userId: string, type: string) {
  return prisma.notification.count({ where: { userId, type } });
}

describe("booking → notification integration", () => {
  it("payment submission notifies owner (new reservation) and customer", async () => {
    const { ownerId, venueId, courtId, customer } = await setup();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, userId: customer.id, customer: { name: "Ana" } });
    await bookingBackend.submitDetails(b.id, { name: "Ana", mobile: "09" }, { type: "CUSTOMER", id: customer.id });
    await bookingBackend.submitPayment(
      b.id,
      { channel: "GCASH", reference: "R", proofKey: "payment-proofs/x.png", amountCents: 40000 },
      { type: "CUSTOMER", id: customer.id },
    );
    expect(await count(ownerId, "NEW_RESERVATION")).toBe(1);
    expect(await count(customer.id, "PAYMENT_SUBMITTED")).toBe(1);
  });

  it("confirm notifies the customer", async () => {
    const { ownerId, venueId, courtId, customer } = await setup();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, userId: customer.id, customer: {} });
    await bookingBackend.submitDetails(b.id, { name: "A", mobile: "09" }, { type: "CUSTOMER", id: customer.id });
    await bookingBackend.submitPayment(b.id, { channel: "GCASH", reference: "R", proofKey: "payment-proofs/x.png", amountCents: 40000 }, { type: "CUSTOMER", id: customer.id });
    await bookingBackend.confirm(b.id, { type: "OWNER", id: ownerId });
    expect(await count(customer.id, "BOOKING_CONFIRMED")).toBe(1);
  });

  it("reject notifies the customer", async () => {
    const { ownerId, venueId, courtId, customer } = await setup();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, userId: customer.id, customer: {} });
    await bookingBackend.submitDetails(b.id, { name: "A", mobile: "09" }, { type: "CUSTOMER", id: customer.id });
    await bookingBackend.submitPayment(b.id, { channel: "GCASH", reference: "R", proofKey: "payment-proofs/x.png", amountCents: 40000 }, { type: "CUSTOMER", id: customer.id });
    await bookingBackend.reject(b.id, { type: "OWNER", id: ownerId }, "No slot");
    expect(await count(customer.id, "BOOKING_REJECTED")).toBe(1);
  });

  it("customer cancel notifies the owner; venue cancel notifies the customer", async () => {
    const { ownerId, venueId, courtId, customer } = await setup();
    const b1 = await bookingBackend.createHold({ venueId, courtId, ...slot(3, 19, 1), priceCents: 40000, userId: customer.id, customer: {} });
    await bookingBackend.cancel(b1.id, { type: "CUSTOMER", id: customer.id });
    expect(await count(ownerId, "CUSTOMER_CANCELLED")).toBe(1);

    const b2 = await bookingBackend.createHold({ venueId, courtId, ...slot(3, 20, 1), priceCents: 40000, userId: customer.id, customer: {} });
    await bookingBackend.cancel(b2.id, { type: "OWNER", id: ownerId });
    expect(await count(customer.id, "BOOKING_CANCELLED")).toBe(1);
  });

  it("expiration notifies the customer", async () => {
    const { venueId, courtId, customer } = await setup();
    const b = await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, userId: customer.id, customer: {} });
    await prisma.booking.update({ where: { id: b.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await bookingBackend.expireStale();
    expect(await count(customer.id, "BOOKING_EXPIRED")).toBe(1);
  });

  it("BOOKING_CREATED is deduped across an idempotent retry", async () => {
    const { venueId, courtId, customer } = await setup();
    const input = { venueId, courtId, ...slot(), priceCents: 40000, userId: customer.id, customer: {}, idempotencyKey: "k1" };
    await bookingBackend.createHold(input);
    await bookingBackend.createHold(input);
    expect(await count(customer.id, "BOOKING_CREATED")).toBe(1);
  });

  it("upcoming-reminder sweep is idempotent", async () => {
    const { venueId, courtId, customer } = await setup();
    const start = new Date(Date.now() + 60 * 60_000);
    const b = await prisma.booking.create({
      data: { reference: newReference(), venueId, courtId, userId: customer.id, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000), status: "CONFIRMED", priceCents: 40000 },
    });
    await notificationService.sweepUpcomingReminders();
    await notificationService.sweepUpcomingReminders();
    expect(await prisma.notification.count({ where: { userId: customer.id, type: "BOOKING_REMINDER", bookingId: b.id } })).toBe(1);
  });
});
