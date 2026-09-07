import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { SlotTakenError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("occupying statuses block the slot", () => {
  it.each(["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED"] as const)(
    "a %s booking still blocks a new hold on the same slot",
    async (status) => {
      const s = await seedOneCourtSlot();
      const b = await bookingBackend.createHold({ ...s, customer: {} });
      await prisma.booking.update({
        where: { id: b.id },
        data: { status, holdExpiresAt: null },
      });

      await expect(bookingBackend.createHold({ ...s, customer: {} })).rejects.toBeInstanceOf(
        SlotTakenError,
      );
    },
  );

  it.each(["EXPIRED", "CANCELLED", "REJECTED"] as const)(
    "a %s booking does NOT block the slot",
    async (status) => {
      const s = await seedOneCourtSlot();
      const b = await bookingBackend.createHold({ ...s, customer: {} });
      await prisma.booking.update({
        where: { id: b.id },
        data: { status, holdExpiresAt: null },
      });

      const fresh = await bookingBackend.createHold({ ...s, customer: {} });
      expect(fresh.status).toBe("HELD");
    },
  );
});
