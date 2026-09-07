import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";

beforeEach(resetDb);

describe("hold expiry", () => {
  it("an expired hold releases the slot for a new booking", async () => {
    const s = await seedOneCourtSlot();
    const first = await bookingBackend.createHold({ ...s, customer: {} });

    // Simulate the hold window elapsing.
    await prisma.booking.update({
      where: { id: first.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });

    // A fresh hold on the same slot succeeds — createHold expires the stale one first.
    const second = await bookingBackend.createHold({ ...s, customer: {} });
    expect(second.id).not.toBe(first.id);

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(
      "EXPIRED",
    );
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(
      "HELD",
    );
  });

  it("expireStale flips only past-due holds", async () => {
    const s = await seedOneCourtSlot();
    const live = await bookingBackend.createHold({ ...s, customer: {} });
    const count = await bookingBackend.expireStale(new Date(Date.now() - 60_000));
    expect(count).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: live.id } })).status).toBe(
      "HELD",
    );
  });
});
