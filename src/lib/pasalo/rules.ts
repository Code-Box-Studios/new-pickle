import { ConflictError, ValidationError } from "@/lib/booking/errors";

/** Existing bookings store Manila civil time as a UTC-shaped Date. */
export function actualStart(startsAt: Date): number {
  return startsAt.getTime() - 8 * 60 * 60_000;
}

export const CLAIM_MS = 10 * 60_000;
export const CUTOFF_MS = 30 * 60_000;

export function assertListingWindow(startsAt: Date, now = Date.now()) {
  if (actualStart(startsAt) - now <= CUTOFF_MS) {
    throw new ConflictError("Pasalo offers close 30 minutes before the game starts.");
  }
}

export function boundedText(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new ValidationError(`${label} must contain ${required ? "1–" : "at most "}${max} characters.`);
  }
  return value.trim();
}

export function assertOfferPrice(price: unknown, originalPrice: number) {
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0 || price > 2147483647) {
    throw new ValidationError("Enter a positive price in whole centavos.");
  }
  if (price >= originalPrice) throw new ValidationError("Pasalo price must be lower than the original booking price.");
}
