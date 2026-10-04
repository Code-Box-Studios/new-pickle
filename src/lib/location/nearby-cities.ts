import type { CityOption } from "@/lib/cities";
import catalog from "@/lib/data/philippine-city-coordinates.json";

interface Point {
  latitude: number;
  longitude: number;
}
export interface NearbyCity {
  city: CityOption;
  distanceKm: number;
}
const points: Record<string, Point> = catalog.cities;

/** City-center distances, calculated locally; never a claim about court distance. */
export function nearbyCities(point: Point, cities: CityOption[]): NearbyCity[] {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    return [];
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  return cities
    .flatMap((city) => {
      const center = points[city.value];
      if (!center) return [];
      const a =
        Math.sin(rad(center.latitude - point.latitude) / 2) ** 2 +
        Math.cos(rad(point.latitude)) *
          Math.cos(rad(center.latitude)) *
          Math.sin(rad(center.longitude - point.longitude) / 2) ** 2;
      const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
      return distanceKm <= 100 ? [{ city, distanceKm }] : [];
    })
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm || a.city.value.localeCompare(b.city.value),
    )
    .slice(0, 4);
}

export function suggestionsForCity(
  value: string,
  cities: CityOption[],
): NearbyCity[] {
  const point = points[value];
  return point
    ? nearbyCities(point, cities)
        .filter((r) => r.city.value !== value)
        .slice(0, 3)
    : [];
}
