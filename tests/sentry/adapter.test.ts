import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { NotFoundError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("LocalBookingBackend.getStatus", () => {
  it("returns the booking's current status and null externalRef", async () => {
    const s = await seedOneCourtSlot();
    const held = await bookingBackend.createHold({ ...s, customer: {} });
    const res = await bookingBackend.getStatus(held.id);
    expect(res.status).toBe("HELD");
    expect(res.externalRef).toBeNull();
  });

  it("throws NotFoundError for a missing booking", async () => {
    await expect(bookingBackend.getStatus("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
