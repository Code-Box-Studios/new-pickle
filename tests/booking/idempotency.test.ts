import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { seedOneCourtSlot } from "../factories";
import { bookingBackend } from "@/lib/booking";

beforeEach(resetDb);

describe("idempotent hold creation", () => {
  it("the same idempotency key returns the same booking and creates no duplicate", async () => {
    const s = await seedOneCourtSlot();
    const key = "idem-abc-123";

    const a = await bookingBackend.createHold({ ...s, idempotencyKey: key, customer: {} });
    const b = await bookingBackend.createHold({ ...s, idempotencyKey: key, customer: {} });

    expect(b.id).toBe(a.id);
    expect(b.reference).toBe(a.reference);
    expect(await prisma.booking.count({ where: { courtId: s.courtId } })).toBe(1);
  });

  it("concurrent submits with the same key still yield one booking", async () => {
    const s = await seedOneCourtSlot();
    const key = "idem-race";
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        bookingBackend.createHold({ ...s, idempotencyKey: key, customer: {} }),
      ),
    );
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(await prisma.booking.count({ where: { courtId: s.courtId } })).toBe(1);
  });
});
