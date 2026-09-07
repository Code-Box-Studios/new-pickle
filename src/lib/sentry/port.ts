// The SentryClient port is expressed in RallyPoint-NORMALIZED terms, NOT in any
// Sentry wire format. A real HttpSentryClient must translate the (currently
// unavailable) Sentry API into these types; that translation is the documented
// TODO. MockSentryClient is the fully-tested reference implementation.

export type ExternalBookingState = "held" | "confirmed" | "cancelled" | "completed" | "rejected";

export interface SentryResource {
  externalRef: string;
  name: string;
  capacity?: number | null;
}

export interface SentryBusyRange {
  startsAt: Date;
  endsAt: Date;
}

export interface SentryBooking {
  externalRef: string;
  state: ExternalBookingState;
  startsAt: Date;
  endsAt: Date;
}

export interface SentryCreateBookingInput {
  resourceRef: string;
  startsAt: Date;
  endsAt: Date;
  customer: { name?: string | null; email?: string | null; mobile?: string | null };
  idempotencyKey?: string | null;
}

export interface SentryClient {
  authCheck(): Promise<void>;
  listResources(): Promise<SentryResource[]>;
  getAvailability(input: { resourceRef: string; from: Date; to: Date }): Promise<SentryBusyRange[]>;
  createBooking(input: SentryCreateBookingInput): Promise<SentryBooking>;
  getBooking(externalRef: string): Promise<SentryBooking>;
  cancelBooking(externalRef: string): Promise<SentryBooking>;
}
