import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking, seedCustomer, slot } from "../factories";
import { createListing, claimListing, markPaymentSent, transferTrade, withdrawListing } from "@/lib/pasalo/service";
import { tradeThread } from "@/lib/pasalo/read";
import { getBookingByReference } from "@/lib/bookings-read";
import { bookingBackend } from "@/lib/booking";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/storage", () => ({ paymentProofStorage: { getBytes: vi.fn(async () => ({ bytes: Buffer.from("proof"), contentType: "image/png" })) } }));
import { getSession } from "@/lib/auth/session";
import { GET as proof } from "@/app/api/proofs/[...key]/route";
import { POST as checkoutStatus } from "@/app/api/bookings/[id]/checkout/status/route";

beforeEach(async () => { await resetDb(); vi.clearAllMocks(); });
async function setup() {
  const b = await seedConfirmedBooking();
  await prisma.paymentSubmission.create({ data: { bookingId: b.bookingId, channel: "GCASH", reference: "ORIGINAL-REF", proofKey: "original.png", amountCents: 40000 } });
  const l = await createListing(b.customerId, { bookingId: b.bookingId, priceCents: 25000, paymentChannel: "GCASH", paymentAccountName: "Seller", paymentAccountNumber: "09171234567" });
  const buyer = await seedCustomer();
  const t = await claimListing(buyer.id, l.id, { customerName: "Buyer", customerMobile: "09181234567" });
  return { ...b, l, buyer, t };
}

describe("Pasalo booking ownership and original payment privacy", () => {
  it("requires withdrawal before customer cancellation; venue cancellation invalidates an offer", async () => {
    const o = await setup();
    await expect(bookingBackend.cancel(o.bookingId, { type: "CUSTOMER", id: o.customerId })).rejects.toThrow(/withdraw/i);
    await markPaymentSent(o.buyer.id, o.t.id);
    await bookingBackend.cancel(o.bookingId, { type: "OWNER", id: o.ownerId });
    const thread = await tradeThread(o.buyer.id, o.t.id);
    expect(thread.trade.status).toBe("VOIDED");
    expect(thread.messages.some(m => /direct payment/i.test(m.body))).toBe(true);
  });
  it("allows customer cancellation after withdrawal", async () => {
    const o = await setup();
    await withdrawListing(o.customerId, o.l.id);
    await bookingBackend.cancel(o.bookingId, { type: "CUSTOMER", id: o.customerId });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: o.bookingId } })).status).toBe("CANCELLED");
  });
  it("voids the original offer when its venue reschedules", async () => {
    const o = await setup();
    const moved = slot(5);
    await bookingBackend.reschedule(o.bookingId, moved.startsAt, moved.endsAt, { type: "OWNER", id: o.ownerId });
    expect((await tradeThread(o.buyer.id, o.t.id)).trade.status).toBe("VOIDED");
  });
  it("rechecks the acting booker under the lock, including an owner who booked another venue", async () => {
    const o = await setup();
    await markPaymentSent(o.buyer.id, o.t.id);
    await transferTrade(o.customerId, o.t.id);
    await expect(bookingBackend.cancel(o.bookingId, { type: "CUSTOMER", id: o.customerId })).rejects.toThrow(/permission|holder/i);
    await prisma.user.update({ where: { id: o.customerId }, data: { role: "OWNER" } });
    await expect(bookingBackend.cancel(o.bookingId, { type: "OWNER", id: o.customerId })).rejects.toThrow(/permission|holder/i);
    const moved = slot(5);
    await expect(bookingBackend.reschedule(o.bookingId, moved.startsAt, moved.endsAt, { type: "CUSTOMER", id: o.customerId })).rejects.toThrow(/permission|holder/i);
    await bookingBackend.cancel(o.bookingId, { type: "CUSTOMER", id: o.buyer.id });
  });
  it("redacts original receipts and denies buyer original proof and checkout access", async () => {
    const o = await setup();
    await markPaymentSent(o.buyer.id, o.t.id);
    const sold = await transferTrade(o.customerId, o.t.id);
    const b = await getBookingByReference(sold.bookingReference, o.buyer.id, "CUSTOMER");
    expect(b?.payment).toBeNull();
    expect(await getBookingByReference(sold.bookingReference, o.customerId, "CUSTOMER")).toBeNull();
    expect(await getBookingByReference(o.reference, o.buyer.id, "CUSTOMER")).toBeNull();
    vi.mocked(getSession).mockResolvedValue({ id: o.buyer.id, email: o.buyer.email, role: "CUSTOMER" });
    expect((await proof(new NextRequest("http://localhost/api/proofs/original.png"), { params: Promise.resolve({ key: ["original.png"] }) })).status).toBe(403);
    const res = await checkoutStatus(new NextRequest(`http://localhost/api/bookings/${o.bookingId}/checkout/status`, { method: "POST", headers: { origin: "http://localhost" } }), { params: Promise.resolve({ id: o.bookingId }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checkout: null });
    vi.mocked(getSession).mockResolvedValue({ id: o.customerId, email: null, role: "CUSTOMER" });
    expect((await proof(new NextRequest("http://localhost/api/proofs/original.png"), { params: Promise.resolve({ key: ["original.png"] }) })).status).toBe(200);
  });
});
