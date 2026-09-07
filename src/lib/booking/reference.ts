import { randomBytes } from "node:crypto";

// Crockford-ish alphabet without ambiguous chars (no I, L, O, 0, 1).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Public booking reference, e.g. `RP-7Q2K9F`. Uniqueness enforced by the DB. */
export function newReference(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `RP-${s}`;
}
