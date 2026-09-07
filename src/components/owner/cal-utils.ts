// Times are wall-clock stored in UTC. Build the matching UTC instant from a
// YYYY-MM-DD day + minutes-from-midnight.
export function isoAt(dateIso: string, minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
}

export function minuteLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function hourOptions(openMinute: number, closeMinute: number): number[] {
  const out: number[] = [];
  for (let m = openMinute; m < closeMinute; m += 60) out.push(m);
  return out;
}
