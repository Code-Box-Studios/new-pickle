import { describe, it, expect } from "vitest";
import { venueCompleteness, type CompletenessInput } from "@/lib/venue/completeness";

const complete: CompletenessInput = {
  name: "Rally Court",
  city: "Davao City",
  photos: ["/api/media/venue-media/a.jpg"],
  courts: [{ active: true, priceCents: 40000, schedules: [{ id: "s1" }] }],
  paymentMethods: [{ active: true }],
};

describe("venueCompleteness", () => {
  it("passes for a fully configured venue", () => {
    expect(venueCompleteness(complete)).toEqual({ ok: true, missing: [] });
  });

  it("flags missing name/city", () => {
    const r = venueCompleteness({ ...complete, name: null });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("Venue name and city");
  });

  it("flags missing photos", () => {
    expect(venueCompleteness({ ...complete, photos: [] }).missing).toContain("At least one photo");
  });

  it("flags no active courts", () => {
    const r = venueCompleteness({ ...complete, courts: [{ active: false, priceCents: 40000, schedules: [{ id: "s" }] }] });
    expect(r.missing).toContain("At least one active court");
  });

  it("flags a court without a price or hours", () => {
    expect(
      venueCompleteness({ ...complete, courts: [{ active: true, priceCents: 0, schedules: [{ id: "s" }] }] }).missing,
    ).toContain("A price for every court");
    expect(
      venueCompleteness({ ...complete, courts: [{ active: true, priceCents: 40000, schedules: [] }] }).missing,
    ).toContain("Operating hours for every court");
  });

  it("flags missing payment methods", () => {
    expect(venueCompleteness({ ...complete, paymentMethods: [] }).missing).toContain(
      "At least one payment method",
    );
    expect(
      venueCompleteness({ ...complete, paymentMethods: [{ active: false }] }).missing,
    ).toContain("At least one payment method");
  });
});
