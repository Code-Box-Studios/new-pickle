// All booking instants are stored as wall-clock in UTC (Davao is UTC+8, no DST),
// so we format with UTC getters to show the exact wall-clock a venue configured.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function pesos(cents: number): string {
  return `₱${Math.round(cents / 100).toLocaleString("en-PH")}`;
}

export function timeLabel(d: Date): string {
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function dateLabel(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function longDateLabel(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function weekdayLabel(d: Date): string {
  return WEEKDAYS[d.getUTCDay()];
}

/** YYYY-MM-DD in UTC — matches the value space of an <input type="date">. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string to that day at 00:00 UTC. */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}
