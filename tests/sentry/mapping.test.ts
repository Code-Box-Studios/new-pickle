import { describe, it, expect } from "vitest";
import { externalStateToStatus, busyRangesToOccupied, holdInputToCreateBooking } from "@/lib/sentry/mapping";

describe("sentry mapping", () => {
  it("maps every external state to a RallyPoint status", () => {
    expect(externalStateToStatus("held")).toBe("HELD");
    expect(externalStateToStatus("confirmed")).toBe("CONFIRMED");
    expect(externalStateToStatus("cancelled")).toBe("CANCELLED");
    expect(externalStateToStatus("completed")).toBe("COMPLETED");
    expect(externalStateToStatus("rejected")).toBe("REJECTED");
  });

  it("maps busy ranges to occupied ranges as CONFIRMED occupancy", () => {
    const a = new Date("2026-09-10T09:00:00Z");
    const b = new Date("2026-09-10T10:00:00Z");
    const occ = busyRangesToOccupied([{ startsAt: a, endsAt: b }]);
    expect(occ).toEqual([{ startsAt: a, endsAt: b, status: "CONFIRMED" }]);
  });

  it("maps a hold input to a create-booking request", () => {
    const startsAt = new Date("2026-09-10T09:00:00Z");
    const endsAt = new Date("2026-09-10T10:00:00Z");
    const req = holdInputToCreateBooking(
      { venueId: "v1", courtId: "c1", startsAt, endsAt, priceCents: 40000, idempotencyKey: "k1", customer: { name: "Ana", email: "a@t.test" } },
      "resource-9",
    );
    expect(req).toEqual({
      resourceRef: "resource-9",
      startsAt,
      endsAt,
      customer: { name: "Ana", email: "a@t.test", mobile: undefined },
      idempotencyKey: "k1",
    });
  });
});
