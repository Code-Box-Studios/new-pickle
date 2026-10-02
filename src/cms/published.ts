/** Public content must be published and must not delay a booking page. */
export async function loadPublishedContent<T extends object>(
  load: () => Promise<Record<string, unknown>>,
  fallback: T,
  timeoutMs = 2000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const content = await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("CMS content deadline exceeded")),
          timeoutMs,
        );
      }),
    ]);
    if (content._status !== "published") return fallback;
    return Object.fromEntries(
      Object.entries(fallback).map(([key, value]) => [
        key,
        content[key] ?? value,
      ]),
    ) as T;
  } catch (error) {
    console.error("Unable to load published CMS content", error);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
