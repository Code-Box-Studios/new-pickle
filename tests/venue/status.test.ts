import { describe, it, expect } from "vitest";
import { canVenueTransition, assertVenueTransition, assertVenueEditable } from "@/lib/venue/status";
import { ConflictError } from "@/lib/booking/errors";

describe("venue status machine", () => {
  it("allows the forward review path", () => {
    expect(canVenueTransition("DRAFT", "PENDING_REVIEW")).toBe(true);
    expect(canVenueTransition("PENDING_REVIEW", "APPROVED")).toBe(true);
    expect(canVenueTransition("PENDING_REVIEW", "REJECTED")).toBe(true);
    expect(canVenueTransition("REJECTED", "PENDING_REVIEW")).toBe(true);
  });

  it("allows suspend/reinstate on approved venues", () => {
    expect(canVenueTransition("APPROVED", "SUSPENDED")).toBe(true);
    expect(canVenueTransition("SUSPENDED", "APPROVED")).toBe(true);
  });

  it("forbids skipping review and reopening approved venues", () => {
    expect(canVenueTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canVenueTransition("APPROVED", "PENDING_REVIEW")).toBe(false);
    expect(canVenueTransition("DRAFT", "SUSPENDED")).toBe(false);
  });

  it("assertVenueTransition throws ConflictError on an illegal move", () => {
    expect(() => assertVenueTransition("DRAFT", "APPROVED")).toThrow(ConflictError);
  });

  it("assertVenueEditable blocks only PENDING_REVIEW", () => {
    expect(() => assertVenueEditable("PENDING_REVIEW")).toThrow(ConflictError);
    for (const s of ["DRAFT", "REJECTED", "APPROVED", "SUSPENDED"] as const) {
      expect(() => assertVenueEditable(s)).not.toThrow();
    }
  });
});
