import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { venue: { findMany } } }));
import { listCities } from "@/lib/venues";

beforeEach(() => findMany.mockResolvedValue([]));

describe("city search options", () => {
  it("offers the national city catalog even without published venues", async () => {
    const cities = await listCities();
    expect(cities).toHaveLength(149);
    expect(cities).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "Davao City" }),
      expect.objectContaining({ value: "Cebu City" }),
      expect.objectContaining({ value: "Carmona City" }),
      expect.objectContaining({ value: "Baliwag City" }),
      expect.objectContaining({ value: "Calaca City" }),
    ]));
  });

  it("distinguishes cities with the same name by their province", async () => {
    const cities = await listCities();
    expect(cities.filter(city => city.name === "San Carlos City")).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "San Carlos City, Pangasinan", province: "Pangasinan" }),
      expect.objectContaining({ value: "San Carlos City, Negros Occidental", province: "Negros Occidental" }),
    ]));
    expect(new Set(cities.map(city => city.value)).size).toBe(cities.length);
  });

  it("keeps existing venue locations searchable without duplicating a national city", async () => {
    findMany.mockResolvedValue([{ city: "Davao City" }, { city: "Pateros" }]);
    const cities = await listCities();
    expect(cities.filter(city => city.value === "Davao City")).toHaveLength(1);
    expect(cities).toContainEqual(expect.objectContaining({ value: "Pateros" }));
  });
});
