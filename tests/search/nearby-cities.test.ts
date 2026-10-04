import { describe, expect, it } from "vitest";
import { PHILIPPINE_CITIES } from "@/lib/cities";
import { nearbyCities, suggestionsForCity } from "@/lib/location/nearby-cities";

describe("nearby Philippine city suggestions", () => {
  it("ranks cities near a device location instead of using the default city", () => {
    const results = nearbyCities(
      { latitude: 10.31672, longitude: 123.89071 },
      PHILIPPINE_CITIES,
    );
    expect(results[0].city.value).toBe("Cebu City");
    expect(results[0].distanceKm).toBeCloseTo(0, 2);
    expect(results.slice(1).map((r) => r.city.value)).toContain("Mandaue City");
    expect(results.map((r) => r.city.value)).not.toContain("Davao City");
  });

  it("distinguishes cities with the same name using their province", () => {
    expect(
      nearbyCities(
        { latitude: 10.20898, longitude: 123.758 },
        PHILIPPINE_CITIES,
      )[0].city.value,
    ).toBe("Naga City, Cebu");
    expect(
      nearbyCities(
        { latitude: 13.61917, longitude: 123.18139 },
        PHILIPPINE_CITIES,
      )[0].city.value,
    ).toBe("Naga City, Camarines Sur");
  });

  it("distinguishes Talisay from Toledo instead of using a misleading place alias", () => {
    expect(
      nearbyCities(
        { latitude: 10.24472, longitude: 123.84944 },
        PHILIPPINE_CITIES,
      )[0].city.value,
    ).toBe("Talisay City, Cebu");
    expect(
      nearbyCities(
        { latitude: 10.3773, longitude: 123.6386 },
        PHILIPPINE_CITIES,
      )[0].city.value,
    ).toBe("Toledo City");
  });

  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 51.5, longitude: -0.12 },
    { latitude: Number.NaN, longitude: 121 },
    { latitude: 91, longitude: 121 },
  ])(
    "does not recommend distant Philippine cities or invalid coordinates: %j",
    (point) => {
      expect(nearbyCities(point, PHILIPPINE_CITIES)).toEqual([]);
    },
  );

  it("suggests nearby alternatives before GPS access without suggesting the selected city again", () => {
    const results = suggestionsForCity("Davao City", PHILIPPINE_CITIES);
    expect(results.map((r) => r.city.value)).toContain("Panabo City");
    expect(results.map((r) => r.city.value)).not.toContain("Davao City");
    expect(results).toHaveLength(3);
    expect(suggestionsForCity("Unknown City", PHILIPPINE_CITIES)).toEqual([]);
  });

  it("only recommends cities available in the picker, even when a closer city exists in the catalog", () => {
    const allowed = PHILIPPINE_CITIES.filter((c) =>
      ["Cebu City", "Davao City"].includes(c.value),
    );
    expect(
      nearbyCities({ latitude: 10.32, longitude: 123.94 }, allowed).map(
        (r) => r.city.value,
      ),
    ).toEqual(["Cebu City"]);
  });
});
