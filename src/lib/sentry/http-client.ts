import type { SentryClient, SentryResource, SentryBusyRange, SentryBooking } from "./port";
import { SentryContractUnavailableError } from "./errors";

// UNVERIFIED. No live Sentry API or documented wire contract is available in
// this workspace, so this client intentionally implements nothing. When the real
// contract is available, each method below must:
//   TODO(real-contract): authenticate with `this.config.apiKey` (Bearer or per
//     Sentry spec), call the documented endpoint under `this.config.baseUrl`,
//     apply an AbortController timeout, translate the real Sentry response/state
//     strings into the normalized port types (ExternalBookingState etc.), and map
//     HTTP failures to the src/lib/sentry/errors.ts taxonomy.
// Until then every method throws SentryContractUnavailableError so nothing can
// silently depend on a fabricated contract.
export class HttpSentryClient implements SentryClient {
  constructor(private readonly config: { baseUrl: string; apiKey: string }) {}

  private unavailable(): never {
    // Note: never include this.config in the error — no secret/base-URL leakage.
    throw new SentryContractUnavailableError();
  }

  async authCheck(): Promise<void> {
    this.unavailable();
  }
  async listResources(): Promise<SentryResource[]> {
    this.unavailable();
  }
  async getAvailability(): Promise<SentryBusyRange[]> {
    this.unavailable();
  }
  async createBooking(): Promise<SentryBooking> {
    this.unavailable();
  }
  async getBooking(): Promise<SentryBooking> {
    this.unavailable();
  }
  async cancelBooking(): Promise<SentryBooking> {
    this.unavailable();
  }
}
