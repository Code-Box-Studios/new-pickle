import { beforeEach, describe, it, expect } from "vitest";
import { resetDb } from "../db";
import { seedOwnerVenueCourt, seedSentryVenue } from "../factories";
import { resolveBackend } from "@/lib/booking/resolve";
import { SentryBookingBackend } from "@/lib/booking/sentry-backend";
import { LocalBookingBackend } from "@/lib/booking/local-backend";

beforeEach(resetDb);

describe("resolveBackend", () => {
  it("returns Local for a venue with no Sentry connection", async () => {
    const v = await seedOwnerVenueCourt();
    expect(await resolveBackend(v.venueId)).toBeInstanceOf(LocalBookingBackend);
  });

  it("returns Sentry for a CONNECTED venue", async () => {
    process.env.SENTRY_MODE = "mock";
    const v = await seedSentryVenue();
    expect(await resolveBackend(v.venueId)).toBeInstanceOf(SentryBookingBackend);
  });
});
