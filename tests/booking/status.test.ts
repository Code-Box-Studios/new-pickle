import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  OCCUPYING,
  isOccupying,
} from "@/lib/booking/status";
import { InvalidTransitionError } from "@/lib/booking/errors";

describe("booking state machine", () => {
  it("allows HELD -> PENDING_PAYMENT", () => {
    expect(canTransition("HELD", "PENDING_PAYMENT")).toBe(true);
  });

  it("forbids skipping straight from HELD to CONFIRMED", () => {
    expect(canTransition("HELD", "CONFIRMED")).toBe(false);
  });

  it("forbids reversing from CONFIRMED back to HELD", () => {
    expect(canTransition("CONFIRMED", "HELD")).toBe(false);
  });

  it("lets the owner confirm or reject from PENDING_CONFIRMATION", () => {
    expect(canTransition("PENDING_CONFIRMATION", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_CONFIRMATION", "REJECTED")).toBe(true);
  });

  it("treats terminal states as having no outgoing transitions", () => {
    for (const t of ["EXPIRED", "CANCELLED", "REJECTED", "COMPLETED"] as const) {
      expect(canTransition(t, "CONFIRMED")).toBe(false);
    }
  });

  it("assertTransition throws InvalidTransitionError on an illegal move", () => {
    expect(() => assertTransition("HELD", "COMPLETED")).toThrow(
      InvalidTransitionError,
    );
  });

  it("occupying set is exactly the five active statuses", () => {
    expect([...OCCUPYING].sort()).toEqual([
      "CONFIRMED",
      "HELD",
      "PAYMENT_SUBMITTED",
      "PENDING_CONFIRMATION",
      "PENDING_PAYMENT",
    ]);
    expect(isOccupying("EXPIRED")).toBe(false);
    expect(isOccupying("CONFIRMED")).toBe(true);
  });
});
