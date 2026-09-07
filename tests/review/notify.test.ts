import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking } from "../factories";
import { bookingBackend } from "@/lib/booking";

beforeEach(resetDb);

describe("REVIEW_INVITE notification", () => {
  it("is created (once) for the customer when a booking is completed", async () => {
    const { ownerId, bookingId, customerId } = await seedConfirmedBooking();
    await bookingBackend.complete(bookingId, { type: "OWNER", id: ownerId });
    const count = await prisma.notification.count({
      where: { userId: customerId, type: "REVIEW_INVITE", bookingId },
    });
    expect(count).toBe(1);
  });
});
