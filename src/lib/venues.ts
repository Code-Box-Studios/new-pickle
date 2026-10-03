import prisma from "@/lib/prisma";
import type { VenueCardData } from "@/components/venue/VenueCard";
import { PHILIPPINE_CITIES, type CityOption } from "@/lib/cities";
import { isPreviewMode } from "@/lib/deployment";

export async function listCities(): Promise<CityOption[]> {
  const rows = isPreviewMode() ? [] : await prisma.venue.findMany({
    where: { isPublished: true, status: "APPROVED" },
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  const options = new Map(PHILIPPINE_CITIES.map(city => [city.value, city]));
  for (const row of rows) {
    if (!options.has(row.city)) options.set(row.city, { value: row.city, name: row.city });
  }
  return [...options.values()].sort((a, b) => a.value.localeCompare(b.value, "en"));
}

export async function featuredVenues(limit = 6): Promise<VenueCardData[]> {
  if (isPreviewMode()) return [];
  const venues = await prisma.venue.findMany({
    where: { isPublished: true, status: "APPROVED" },
    include: { courts: { where: { active: true } } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: limit,
  });
  return venues.map((v) => ({
    slug: v.slug,
    name: v.name,
    barangay: v.barangay,
    city: v.city,
    photos: v.photos,
    ratingAvg: v.ratingAvg,
    ratingCount: v.ratingCount,
    indoor: v.courts.some((c) => c.indoor),
    courtCount: v.courts.length,
    priceFromCents: v.courts.length
      ? Math.min(...v.courts.map((c) => c.priceCents))
      : null,
  }));
}
