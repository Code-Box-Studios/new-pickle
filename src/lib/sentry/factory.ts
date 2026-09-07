import prisma from "@/lib/prisma";
import type { SentryClient } from "./port";
import { MockSentryClient } from "./mock-client";
import { HttpSentryClient } from "./http-client";
import { credentialCipher } from "./credentials";

// Returns a MockSentryClient when SENTRY_MODE=mock (dev + HTTP e2e), else a real
// (currently unverified) HttpSentryClient built from the venue's connection.
export async function sentryClientForVenue(venueId: string): Promise<SentryClient> {
  const conn = await prisma.sentryConnection.findUnique({ where: { venueId } });

  if (process.env.SENTRY_MODE === "mock") {
    const courts = await prisma.court.findMany({
      where: { venueId, externalRef: { not: null } },
      select: { externalRef: true, name: true },
    });
    return new MockSentryClient({
      resources: courts.map((c) => ({ externalRef: c.externalRef as string, name: c.name })),
    });
  }

  const apiKey = conn?.encryptedApiKey ? credentialCipher.decrypt(conn.encryptedApiKey) : "";
  const baseUrl = process.env.SENTRY_BASE_URL ?? "";
  return new HttpSentryClient({ baseUrl, apiKey });
}
