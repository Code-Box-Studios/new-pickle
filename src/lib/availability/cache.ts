/**
 * Tiny in-memory TTL cache so browsing doesn't recompute multi-venue search on
 * every keystroke/refresh. Per-process; fine for the MVP's ~3–5 venues. A
 * webhook-fed availability cache is the scale story.
 */
type Entry = { value: unknown; expires: number };

const g = globalThis as unknown as { __rpCache?: Map<string, Entry> };
const store: Map<string, Entry> = g.__rpCache ?? (g.__rpCache = new Map());

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function clearCache(): void {
  store.clear();
}
