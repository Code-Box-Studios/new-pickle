import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedOwnerVenueCourt, slot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { assertCourtDeletable } from "@/lib/venue/court";
import { ConflictError } from "@/lib/booking/errors";

beforeEach(resetDb);

describe("assertCourtDeletable", () => {
  it("allows deleting a court with no live bookings", async () => {
    const { courtId } = await seedOwnerVenueCourt();
    await expect(assertCourtDeletable(courtId)).resolves.toBeUndefined();
  });

  it("refuses to delete a court that has an occupying booking", async () => {
    const { venueId, courtId } = await seedOwnerVenueCourt();
    await bookingBackend.createHold({ venueId, courtId, ...slot(), priceCents: 40000, customer: {} });
    await expect(assertCourtDeletable(courtId)).rejects.toBeInstanceOf(ConflictError);
  });
});
