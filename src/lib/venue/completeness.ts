/**
 * Whether a venue has everything required to be submitted for review and to be
 * published. Used by both the submit and publish paths (publish re-checks).
 */
export interface CompletenessInput {
  name: string | null;
  city: string | null;
  photos: string[];
  courts: { active: boolean; priceCents: number; schedules: { id: string }[] }[];
  paymentMethods: { active: boolean }[];
}

export function venueCompleteness(v: CompletenessInput): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!v.name || !v.city) missing.push("Venue name and city");
  if (v.photos.length === 0) missing.push("At least one photo");

  const activeCourts = v.courts.filter((c) => c.active);
  if (activeCourts.length === 0) missing.push("At least one active court");
  if (activeCourts.some((c) => c.priceCents <= 0)) missing.push("A price for every court");
  if (activeCourts.some((c) => c.schedules.length === 0)) missing.push("Operating hours for every court");
  if (!v.paymentMethods.some((p) => p.active)) missing.push("At least one payment method");

  return { ok: missing.length === 0, missing };
}
