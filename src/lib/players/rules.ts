import { ConflictError, ValidationError } from "@/lib/booking/errors";
import type { MatchInput } from "./types";

export const MAX_ROSTER = 32;
export const EDITABLE_STATUSES = ["HELD", "PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PENDING_CONFIRMATION", "CONFIRMED"];
export function actualTime(civil: Date) { return civil.getTime() - 8 * 3600000; }
export function hasFinished(b: { status: string; endsAt: Date }) { return b.status === "COMPLETED" && actualTime(b.endsAt) <= Date.now(); }
export function canEditRoster(b: { status: string; startsAt: Date }) { return EDITABLE_STATUSES.includes(b.status) && actualTime(b.startsAt) > Date.now(); }
export function assertEditableRoster(b: { status: string; startsAt: Date }) {
  if (!canEditRoster(b)) throw new ConflictError("The roster is closed because the game has started or this reservation is no longer active.");
}
export function assertFinished(b: { status: string; endsAt: Date }) {
  if (!hasFinished(b)) throw new ConflictError("Attendance and results open after the venue marks this booking completed and its game time has ended.");
}
export function text(value: unknown, label: string, max = 60, optional = false): string {
  if (optional && value == null) return "";
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim())) throw new ValidationError(`${label} must contain ${optional ? "at most " : "1–"}${max} characters.`);
  return value.trim();
}
export function validateMatch(input: MatchInput) {
  if (!input || (input.format !== "SINGLES" && input.format !== "DOUBLES")) throw new ValidationError("Choose singles or doubles.");
  const size = input.format === "SINGLES" ? 1 : 2;
  if (!Array.isArray(input.teamA) || !Array.isArray(input.teamB) || input.teamA.length !== size || input.teamB.length !== size) throw new ValidationError(`Each team needs ${size} player${size > 1 ? "s" : ""}.`);
  const ids = [...input.teamA, ...input.teamB];
  if (ids.some(id => typeof id !== "string" || !id || id.length > 100) || new Set(ids).size !== ids.length) throw new ValidationError("Select distinct players for the two teams.");
  if (!["A", "B", "UNFINISHED"].includes(input.winner)) throw new ValidationError("Choose the winning team or unfinished.");
  const a = input.scoreA ?? null, b = input.scoreB ?? null;
  if ((a === null) !== (b === null) || [a, b].some(n => n !== null && (!Number.isInteger(n) || n < 0 || n > 999))) throw new ValidationError("Enter both scores as whole numbers from 0 to 999, or leave both blank.");
  if (a !== null && b !== null && ((input.winner === "A" && a <= b) || (input.winner === "B" && b <= a))) throw new ValidationError("The winning team must have the higher score.");
  return { ...input, scoreA: a, scoreB: b, note: text(input.note, "Result note", 200, true) || null };
}
