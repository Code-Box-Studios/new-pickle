import prisma from "@/lib/prisma";
import type { VenueCardData } from "@/components/venue/VenueCard";

export async function listCities(): Promise<string[]> {
  const rows = await prisma.venue.findMany({
    where: { isPublished: true, status: "APPROVED" },
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  return rows.map((r) => r.city);
}

export async function featuredVenues(limit = 6): Promise<VenueCardData[]> {
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
