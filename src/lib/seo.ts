export interface VenueSeo {
  name: string;
  description: string | null;
  addressLine: string | null;
  barangay: string | null;
  city: string;
  photos: string[];
  ratingAvg: number;
  ratingCount: number;
}

export function venueJsonLd(v: VenueSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: v.name,
    description: v.description ?? undefined,
    image: v.photos,
    address: {
      "@type": "PostalAddress",
      streetAddress: v.addressLine ?? undefined,
      addressLocality: v.barangay ? `${v.barangay}, ${v.city}` : v.city,
      addressCountry: "PH",
    },
    aggregateRating:
      v.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: v.ratingAvg.toFixed(1),
            reviewCount: v.ratingCount,
          }
        : undefined,
  };
}
