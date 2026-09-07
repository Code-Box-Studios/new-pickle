import { LocalBookingBackend } from "./local-backend";
import type { BookingBackend } from "./backend";

/**
 * The authoritative booking backend for this slice. A future Sentry adapter
 * plugs in here (per connected venue) without changing callers.
 */
export const bookingBackend: BookingBackend = new LocalBookingBackend();

export * from "./backend";
export * from "./status";
export * from "./errors";
