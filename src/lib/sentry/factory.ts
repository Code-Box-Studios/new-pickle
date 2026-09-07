import prisma from "@/lib/prisma";
import type { SentryClient } from "./port";
import { MockSentryClient } from "./mock-client";
import { HttpSentryClient } from "./http-client";
import { credentialCipher } from "./credentials";

// A process-global, per-venue mock "server" so state (bookings/availability)
// persists across requests when SENTRY_MODE=mock — a fresh mock per request
// would forget bookings between createHold and getStatus.
const g = globalThis as unknown as { __rpSentryMocks?: Map<string, MockSentryClient> };
const mocks: Map<string, MockSentryClient> = g.__rpSentryMocks ?? (g.__rpSentryMocks = new Map());

// Returns a MockSentryClient when SENTRY_MODE=mock (dev + HTTP e2e), else a real
// (currently unverified) HttpSentryClient built from the venue's connection.
export async function sentryClientForVenue(venueId: string): Promise<SentryClient> {
  const conn = await prisma.sentryConnection.findUnique({ where: { venueId } });

  if (process.env.SENTRY_MODE === "mock") {
    let mock = mocks.get(venueId);
    if (!mock) {
      const courts = await prisma.court.findMany({
        where: { venueId, externalRef: { not: null } },
        select: { externalRef: true, name: true },
      });
      mock = new MockSentryClient({
        resources: courts.map((c) => ({ externalRef: c.externalRef as string, name: c.name })),
      });
      mocks.set(venueId, mock);
    }
    return mock;
  }

  const apiKey = conn?.encryptedApiKey ? credentialCipher.decrypt(conn.encryptedApiKey) : "";
  const baseUrl = process.env.SENTRY_BASE_URL ?? "";
  return new HttpSentryClient({ baseUrl, apiKey });
}
