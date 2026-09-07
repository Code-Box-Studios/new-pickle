import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";
import { SlotTakenError } from "@/lib/booking/errors";
import { OCCUPYING } from "@/lib/booking/status";

beforeEach(resetDb);

describe("double-booking protection", () => {
  it("exactly one of N concurrent holds on the same slot wins", async () => {
    const { venueId, courtId, startsAt, endsAt, priceCents } = await seedOneCourtSlot();

    const attempts = Array.from({ length: 8 }, () =>
      bookingBackend
        .createHold({ venueId, courtId, startsAt, endsAt, priceCents, customer: {} })
        .then(() => "ok" as const)
        .catch((e) => (e instanceof SlotTakenError ? "taken" : `err:${(e as Error).name}`)),
    );

    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "taken")).toHaveLength(7);

    const occupying = await prisma.booking.count({
      where: { courtId, status: { in: OCCUPYING } },
    });
    expect(occupying).toBe(1);
  });
});
