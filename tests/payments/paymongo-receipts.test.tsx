import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot, seedCustomer } from "../factories";
import { bookingBackend } from "@/lib/booking";
import BookingStatusPage from "@/app/(frontend)/(site)/bookings/[reference]/page";
import OwnerReservationDetail from "@/app/(frontend)/(owner)/owner/reservations/[reference]/page";
const auth = vi.hoisted(() => ({ userId: "", ownerId: "" }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ id: auth.userId, role: "CUSTOMER" }),
}));
vi.mock("@/lib/auth/owner-page", () => ({
  getOwnerPageSession: async () => ({ id: auth.ownerId, role: "OWNER" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error("Not found");
  },
  redirect: () => {
    throw new Error("Redirected");
  },
}));
vi.mock("@/components/owner/ConfirmRejectActions", () => ({
  ConfirmRejectActions: () => null,
}));
vi.mock("@/components/owner/ManageActions", () => ({
  ManageActions: () => null,
}));
beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
describe("manual receipts after hosted checkout ends", () => {
  it.each([
    ["FAILED", "player"],
    ["EXPIRED", "player"],
    ["FAILED", "owner"],
    ["EXPIRED", "owner"],
  ] as const)(
    "shows the actual manual receipt after %s to the %s without sandbox labeling",
    async (status, view) => {
      const s = await seedOneCourtSlot(),
        user = await seedCustomer();
      auth.userId = user.id;
      auth.ownerId = s.ownerId;
      vi.stubEnv("PAYMONGO_LEDGER_READY", "true");
      const b = await bookingBackend.createHold({
        ...s,
        userId: user.id,
        customer: {},
      });
      await bookingBackend.submitDetails(
        b.id,
        { name: "Player" },
        { type: "CUSTOMER", id: user.id },
      );
      await prisma.paymentCheckout.create({
        data: {
          bookingId: b.id,
          merchantAlias: "default",
          mode: "test",
          recipientOwnerId: s.ownerId,
          amountCents: 40000,
          holdExpiresAt: b.holdExpiresAt!,
          status,
        },
      });
      await bookingBackend.submitPayment(
        b.id,
        {
          channel: "GCASH",
          reference: "actual-manual-receipt",
          proofKey: "payment-proofs/manual.png",
          amountCents: 40000,
        },
        { type: "CUSTOMER", id: user.id },
      );
      const receipt = renderToStaticMarkup(
        await (view === "player" ? BookingStatusPage : OwnerReservationDetail)({
          params: Promise.resolve({ reference: b.reference }),
        }),
      );
      expect(receipt.includes("actual-manual-receipt")).toBe(true);
      expect(receipt.includes("Online checkout ended")).toBe(false);
      expect(receipt.includes("sandbox only, no real funds")).toBe(false);
      if (view === "owner")
        expect(receipt.includes("payment-proofs/manual.png")).toBe(true);
    },
  );
});
