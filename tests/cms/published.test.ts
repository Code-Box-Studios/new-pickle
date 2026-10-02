import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPublishedContent } from "@/cms/published";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("CMS fallback deadline", () => {
  it("returns defaults when a content load never answers", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const defaults = { heroTitle: "Find your" };
    const result = loadPublishedContent(
      () => new Promise(() => {}),
      defaults,
      2000,
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toEqual(defaults);
  });
});
