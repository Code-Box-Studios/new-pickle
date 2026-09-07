export const TIME_PRESETS = [
  { value: "any", label: "Any time", from: undefined, to: undefined },
  { value: "morning", label: "Morning", from: 6 * 60, to: 12 * 60 },
  { value: "afternoon", label: "Afternoon", from: 12 * 60, to: 17 * 60 },
  { value: "evening", label: "Evening", from: 17 * 60, to: 23 * 60 },
] as const;

export const DURATIONS = [
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "180", label: "3 hours" },
] as const;

export function resolveTimeWindow(preset?: string): { from?: number; to?: number } {
  const p = TIME_PRESETS.find((t) => t.value === preset);
  return { from: p?.from, to: p?.to };
}
