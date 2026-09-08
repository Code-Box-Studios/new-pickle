import { describe, it, expect } from "vitest";
import { cityNames, barangaysForCity, OTHER } from "@/lib/location/ph-locations";

describe("ph-locations", () => {
  it("exposes exactly the two canonical pilot cities", () => {
    expect(cityNames()).toEqual(["Davao City", "Tagum City"]); // canonical, byte-exact
  });

  it("lists all 23 Tagum barangays including Magugpo West", () => {
    const brgys = barangaysForCity("Tagum City");
    expect(brgys).toHaveLength(23);
    expect(brgys).toContain("Magugpo West");
  });

  it("lists Davao barangays including the real seed names", () => {
    const brgys = barangaysForCity("Davao City");
    expect(brgys).toEqual(expect.arrayContaining(["Agdao", "Buhangin", "Toril"]));
    expect(brgys).not.toContain("Lanang"); // not an official barangay
    expect(brgys).not.toContain("Matina"); // split into Aplaya/Crossing/Pangi
  });

  it("returns an empty list for an unknown/custom city or the sentinel", () => {
    expect(barangaysForCity("Panabo City")).toEqual([]);
    expect(barangaysForCity("Other")).toEqual([]);
  });

  it("exports the Other sentinel", () => {
    expect(OTHER).toBe("Other");
  });
});
