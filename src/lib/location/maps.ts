import { ValidationError } from "@/lib/booking/errors";

/** Structural subset — deliberately NOT the Prisma Venue type, so this stays node-testable. */
export interface VenueLocation {
  mapUrl: string | null;
  name: string;
  addressLine: string | null;
  barangay: string | null;
  city: string;
}

const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

export function isValidMapUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;          // https-only
  return ALLOWED_HOSTS.has(u.hostname.toLowerCase()); // exact host match, never endsWith
}

/** Always returns a usable URL: the owner's link when valid, else a trusted search URL. */
export function venueMapUrl(v: VenueLocation): string {
  if (v.mapUrl && isValidMapUrl(v.mapUrl)) return v.mapUrl;
  const query = [v.name, v.addressLine, v.barangay, v.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Coerce owner form input: null when blank, trimmed valid link, else ValidationError. */
export function normalizeMapUrlInput(raw: unknown): string | null {
  const value = raw == null ? "" : String(raw).trim();
  if (value === "") return null;
  if (!isValidMapUrl(value)) throw new ValidationError("Enter a valid Google Maps link");
  return value;
}
