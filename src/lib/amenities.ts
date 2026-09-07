export const AMENITY_LABELS: Record<string, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  covered: "Covered",
  lights: "Night lights",
  parking: "Parking",
  restroom: "Restrooms",
  shower: "Showers",
  paddle_rental: "Paddle rental",
  ball_rental: "Ball rental",
  lounge: "Lounge",
  water: "Water station",
  aircon: "Air-conditioned",
};

export function amenityLabel(key: string): string {
  return AMENITY_LABELS[key] ?? key.replace(/_/g, " ");
}
