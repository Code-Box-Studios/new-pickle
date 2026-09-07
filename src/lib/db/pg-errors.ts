/**
 * Postgres error classification. Prisma surfaces DB errors in a few shapes:
 * - unique violations arrive as a known error with code `P2002`;
 * - exclusion violations and others arrive as unknown errors whose message
 *   carries the SQLSTATE and/or the constraint name.
 * We normalise all of that here.
 */

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

function codeOf(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

/** SQLSTATE 23P01 — a row violated the `bookings_no_overlap` EXCLUDE constraint. */
export function isExclusionViolation(e: unknown): boolean {
  const msg = messageOf(e);
  return (
    msg.includes("23P01") ||
    msg.includes("bookings_no_overlap") ||
    msg.includes("exclusion constraint")
  );
}

/** SQLSTATE 23505 — unique violation (Prisma P2002, or raw). */
export function isUniqueViolation(e: unknown): boolean {
  return codeOf(e) === "P2002" || messageOf(e).includes("23505");
}

/** Serialization failure / deadlock — safe to retry the whole transaction. */
export function isRetryable(e: unknown): boolean {
  const msg = messageOf(e);
  return msg.includes("40001") || msg.includes("40P01");
}

/**
 * Retry a transaction on transient conditions: unique-reference collisions,
 * idempotency-key races (the retry re-reads and returns the existing row), and
 * serialization/deadlock failures. Exclusion violations are NOT retried — the
 * slot is genuinely taken.
 */
export async function withBookingRetry<T>(
  fn: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retry = isUniqueViolation(e) || isRetryable(e);
      if (!retry || i === attempts - 1) throw e;
    }
  }
  throw last;
}
