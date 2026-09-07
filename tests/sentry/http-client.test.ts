import { describe, it, expect } from "vitest";
import { HttpSentryClient } from "@/lib/sentry/http-client";
import type { SentryClient } from "@/lib/sentry/port";
import { SentryContractUnavailableError } from "@/lib/sentry/errors";

describe("HttpSentryClient (unverified)", () => {
  // Exercised through the port, the way real callers use it.
  const c: SentryClient = new HttpSentryClient({ baseUrl: "https://sentry.example", apiKey: "secret" });

  it("throws SentryContractUnavailableError for every operation", async () => {
    await expect(c.authCheck()).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.listResources()).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.getAvailability({ resourceRef: "r", from: new Date(), to: new Date() })).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.createBooking({ resourceRef: "r", startsAt: new Date(), endsAt: new Date(), customer: {} })).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.getBooking("x")).rejects.toBeInstanceOf(SentryContractUnavailableError);
    await expect(c.cancelBooking("x")).rejects.toBeInstanceOf(SentryContractUnavailableError);
  });

  it("never leaks the api key in the error message", async () => {
    let message = "";
    try {
      await c.authCheck();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("secret");
  });
});
