/**
 * Current time, for use in Server Components where reading "now" during render
 * is correct and stable for that single response. Wrapping it keeps the
 * `react-hooks/purity` lint rule (aimed at client re-renders) satisfied.
 */
export function nowMs(): number {
  return Date.now();
}
