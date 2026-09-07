import prisma from "@/lib/prisma";
import type { BookingBackend } from "./backend";
import { bookingBackend } from "./index";
import { SentryBookingBackend } from "./sentry-backend";
import { sentryClientForVenue } from "@/lib/sentry/factory";

// Choose the backend for a venue. SENTRY when its connection is CONNECTED, else
// the authoritative local singleton (unchanged).
export async function resolveBackend(venueId: string): Promise<BookingBackend> {
  const conn = await prisma.sentryConnection.findUnique({
    where: { venueId },
    select: { connectionState: true },
  });
  if (conn?.connectionState === "CONNECTED") {
    return new SentryBookingBackend(await sentryClientForVenue(venueId));
  }
  return bookingBackend;
}
