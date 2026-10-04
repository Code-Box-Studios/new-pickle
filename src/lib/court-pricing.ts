import { ValidationError } from "@/lib/booking/errors";

export const COURT_RATE_PERIODS = [
  { period: "midnight", label: "Midnight", startMinute: 0, endMinute: 360 },
  { period: "morning", label: "Morning", startMinute: 360, endMinute: 720 },
  {
    period: "afternoon",
    label: "Afternoon",
    startMinute: 720,
    endMinute: 1020,
  },
  { period: "evening", label: "Evening", startMinute: 1020, endMinute: 1440 },
] as const;

export type CourtTimeRate = {
  period: (typeof COURT_RATE_PERIODS)[number]["period"];
  startMinute: number;
  endMinute: number;
  priceCents: number;
};

type CourtPricing = { priceCents: number; timeRates?: unknown };
const MAX_PRICE_CENTS = 2_147_483_647;

/** Money is stored as integer centavos, within the database's Int range. */
export function validateCourtPrice(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_CENTS
  ) {
    throw new ValidationError("Enter a nonnegative price in whole centavos");
  }
  return value;
}

/** Daily bands use venue wall-clock minutes, with an exclusive end boundary. */
export function normalizeCourtTimeRates(value: unknown): CourtTimeRate[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > COURT_RATE_PERIODS.length) {
    throw new ValidationError("Enter up to four time rates");
  }
  const periods = new Set<string>();
  const rates = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new ValidationError("Invalid time rate");
      }
      const band = entry as Record<string, unknown>;
      const period = COURT_RATE_PERIODS.find(
        (p) => p.period === band.period,
      )?.period;
      if (!period || periods.has(period)) {
        throw new ValidationError("Use each time period only once");
      }
      periods.add(period);
      const { startMinute, endMinute } = band;
      if (
        typeof startMinute !== "number" ||
        !Number.isInteger(startMinute) ||
        typeof endMinute !== "number" ||
        !Number.isInteger(endMinute) ||
        startMinute < 0 ||
        endMinute > 1440 ||
        startMinute >= endMinute
      ) {
        throw new ValidationError(
          "Time rates must start and end on a whole minute between 00:00 and 24:00",
        );
      }
      return {
        period,
        startMinute,
        endMinute,
        priceCents: validateCourtPrice(band.priceCents),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute);
  if (
    rates.some(
      (band, index) =>
        index > 0 && band.startMinute < rates[index - 1].endMinute,
    )
  ) {
    throw new ValidationError("Time rates must not overlap");
  }
  return rates;
}

/** Lowest applicable hourly price, including the base rate only for gaps. */
export function minimumCourtHourlyPrice(court: CourtPricing): number {
  const base = validateCourtPrice(court.priceCents);
  const rates = normalizeCourtTimeRates(court.timeRates);
  const coveredMinutes = rates.reduce(
    (sum, band) => sum + band.endMinute - band.startMinute,
    0,
  );
  const prices = rates.map((band) => band.priceCents);
  if (coveredMinutes < 1440) prices.push(base);
  return Math.min(...prices);
}

/** Sum each portion's hourly rate over the full interval, rounding once. */
export function courtIntervalPrice(
  court: CourtPricing,
  startsAt: Date,
  endsAt: Date,
): number {
  const base = validateCourtPrice(court.priceCents);
  const rates = normalizeCourtTimeRates(court.timeRates);
  const start = startsAt.getTime(),
    end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new ValidationError("Invalid booking interval");
  }
  let centMilliseconds = base * (end - start);
  if (rates.length) {
    const day = new Date(start);
    day.setUTCHours(0, 0, 0, 0);
    for (let midnight = day.getTime(); midnight < end; midnight += 86_400_000) {
      for (const band of rates) {
        const bandStart = midnight + band.startMinute * 60_000;
        const bandEnd = midnight + band.endMinute * 60_000;
        const overlap = Math.max(
          0,
          Math.min(end, bandEnd) - Math.max(start, bandStart),
        );
        centMilliseconds += (band.priceCents - base) * overlap;
      }
    }
  }
  return validateCourtPrice(Math.round(centMilliseconds / 3_600_000));
}
