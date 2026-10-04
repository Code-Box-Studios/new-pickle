import { describe, expect, it } from "vitest";
import {
  courtIntervalPrice,
  minimumCourtHourlyPrice,
} from "@/lib/court-pricing";
import { ValidationError } from "@/lib/booking/errors";

describe("daily court rate totals", () => {
  it("uses the flat rate for gaps between custom bands", () => {
    const court = {
      priceCents: 40000,
      timeRates: [
        {
          period: "afternoon",
          startMinute: 720,
          endMinute: 990,
          priceCents: 50000,
        },
        {
          period: "evening",
          startMinute: 1050,
          endMinute: 1440,
          priceCents: 70000,
        },
      ],
    };
    // 16:00–16:30 = ₱250, 16:30–17:30 = ₱400, 17:30–18:00 = ₱350.
    expect(
      courtIntervalPrice(
        court,
        new Date("2026-10-05T16:00:00Z"),
        new Date("2026-10-05T18:00:00Z"),
      ),
    ).toBe(100000);
    expect(minimumCourtHourlyPrice(court)).toBe(40000);
  });

  it("rounds the complete interval once across a minute boundary", () => {
    const court = {
      priceCents: 0,
      timeRates: [
        { period: "morning", startMinute: 660, endMinute: 720, priceCents: 30 },
        {
          period: "afternoon",
          startMinute: 720,
          endMinute: 780,
          priceCents: 30,
        },
      ],
    };
    // Two portions of 0.5 cent each make exactly one cent.
    expect(
      courtIntervalPrice(
        court,
        new Date("2026-10-05T11:59:00Z"),
        new Date("2026-10-05T12:01:00Z"),
      ),
    ).toBe(1);
  });

  it("uses the new band exactly at its start and excludes the ending instant", () => {
    const court = {
      priceCents: 40000,
      timeRates: [
        {
          period: "evening",
          startMinute: 1020,
          endMinute: 1440,
          priceCents: 70000,
        },
      ],
    };
    expect(
      courtIntervalPrice(
        court,
        new Date("2026-10-05T16:00:00Z"),
        new Date("2026-10-05T17:00:00Z"),
      ),
    ).toBe(40000);
    expect(
      courtIntervalPrice(
        court,
        new Date("2026-10-05T17:00:00Z"),
        new Date("2026-10-05T18:00:00Z"),
      ),
    ).toBe(70000);
  });

  it("omits an unused lower base rate when all day is covered", () => {
    const court = {
      priceCents: 100,
      timeRates: [
        {
          period: "morning",
          startMinute: 0,
          endMinute: 1440,
          priceCents: 60000,
        },
      ],
    };
    expect(minimumCourtHourlyPrice(court)).toBe(60000);
  });

  it("preserves free rates for zero-price bands", () => {
    const court = {
      priceCents: 40000,
      timeRates: [
        { period: "morning", startMinute: 360, endMinute: 720, priceCents: 0 },
      ],
    };
    expect(minimumCourtHourlyPrice(court)).toBe(0);
    expect(
      courtIntervalPrice(
        court,
        new Date("2026-10-05T10:00:00Z"),
        new Date("2026-10-05T11:00:00Z"),
      ),
    ).toBe(0);
  });

  it.each([
    ["2026-10-05T10:00:00Z", "2026-10-05T10:00:00Z"],
    ["2026-10-05T11:00:00Z", "2026-10-05T10:00:00Z"],
    ["invalid", "2026-10-05T10:00:00Z"],
  ])("rejects an invalid booking interval %s–%s", (start, end) => {
    expect(() =>
      courtIntervalPrice({ priceCents: 40000 }, new Date(start), new Date(end)),
    ).toThrow(ValidationError);
  });
});
