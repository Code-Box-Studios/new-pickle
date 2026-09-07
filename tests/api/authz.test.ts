import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { getBookingByReference } from "@/lib/bookings-read";

beforeEach(resetDb);

describe("cross-user booking access", () => {
  it("a user cannot read another user's booking by reference", async () => {
    const s = await seedOneCourtSlot();
    const a = await prisma.user.create({ data: { email: `a-${randomUUID().slice(0, 8)}@t.test` } });
    const b = await prisma.user.create({ data: { email: `b-${randomUUID().slice(0, 8)}@t.test` } });

    const held = await bookingBackend.createHold({ ...s, userId: a.id, customer: {} });

    expect(await getBookingByReference(held.reference, b.id, "CUSTOMER")).toBeNull();
    expect(await getBookingByReference(held.reference, a.id, "CUSTOMER")).not.toBeNull();
    // Admins can inspect any booking.
    expect(await getBookingByReference(held.reference, b.id, "ADMIN")).not.toBeNull();
  });
});
