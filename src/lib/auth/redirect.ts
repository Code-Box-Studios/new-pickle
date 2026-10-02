/** Keep email sign-in destinations on this application. */
export function safeNextPath(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded))
      return;
    const url = new URL(value, "https://rallypoint.invalid");
    return url.origin === "https://rallypoint.invalid" ? value : undefined;
  } catch {
    return;
  }
}
