import type { BookingStatus } from "@/generated/prisma";
import type { OccupiedRange, HoldInput } from "@/lib/booking/backend";
import type { ExternalBookingState, SentryBusyRange, SentryCreateBookingInput } from "./port";

// Documented mapping over the NORMALIZED port vocabulary only (not Sentry's real
// state strings, which are unavailable here). `held -> HELD` deliberately: the
// Sentry connector does NOT drive RallyPoint's payment-submitted /
// venue-confirmation semantics, so it never maps to PENDING_CONFIRMATION.
const STATE_TO_STATUS: Record<ExternalBookingState, BookingStatus> = {
  held: "HELD",
  confirmed: "CONFIRMED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  rejected: "REJECTED",
};

export function externalStateToStatus(state: ExternalBookingState): BookingStatus {
  return STATE_TO_STATUS[state];
}

export function busyRangesToOccupied(ranges: SentryBusyRange[]): OccupiedRange[] {
  return ranges.map((r) => ({ startsAt: r.startsAt, endsAt: r.endsAt, status: "CONFIRMED" as BookingStatus }));
}

export function holdInputToCreateBooking(input: HoldInput, resourceRef: string): SentryCreateBookingInput {
  return {
    resourceRef,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    customer: {
      name: input.customer.name ?? undefined,
      email: input.customer.email ?? undefined,
      mobile: input.customer.mobile ?? undefined,
    },
    idempotencyKey: input.idempotencyKey ?? undefined,
  };
}
