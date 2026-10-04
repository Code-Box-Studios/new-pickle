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

export function resolveTimeWindow(preset?: string): {
  from?: number;
  to?: number;
} {
  const p = TIME_PRESETS.find((t) => t.value === preset);
  return { from: p?.from, to: p?.to };
}

/** Civil day in the app's Philippine market, independent of a visitor's timezone. */
export function philippineDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function quickDateChoices(today: string) {
  const day = new Date(`${today}T00:00:00Z`),
    tomorrow = new Date(day),
    weekend = new Date(day);
  tomorrow.setUTCDate(day.getUTCDate() + 1);
  // Saturday/Sunday visitors can play this weekend, without jumping a week ahead.
  const offset = [0, 6].includes(day.getUTCDay()) ? 0 : 6 - day.getUTCDay();
  weekend.setUTCDate(day.getUTCDate() + offset);
  return [
    { label: "Today", value: today },
    { label: "Tomorrow", value: tomorrow.toISOString().slice(0, 10) },
    { label: "This weekend", value: weekend.toISOString().slice(0, 10) },
  ];
}
