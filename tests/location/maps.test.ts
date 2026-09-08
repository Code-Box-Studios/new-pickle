import { describe, it, expect } from "vitest";
import { isValidMapUrl, venueMapUrl, normalizeMapUrlInput } from "@/lib/location/maps";
import { ValidationError } from "@/lib/booking/errors";

describe("isValidMapUrl", () => {
  it("accepts https Google Maps hosts including share shorteners", () => {
    for (const url of [
      "https://www.google.com/maps/place/Foo",
      "https://google.com/maps?q=1,2",
      "https://maps.google.com/?q=1,2",
      "https://maps.app.goo.gl/abc123",
      "https://goo.gl/maps/abc123",
    ]) expect(isValidMapUrl(url)).toBe(true);
  });

  it("rejects look-alike and off-allowlist hosts (exact match only)", () => {
    for (const url of [
      "https://google.com.evil.com/maps",
      "https://evilgoogle.com/maps",
      "https://maps.example.com/",
    ]) expect(isValidMapUrl(url)).toBe(false);
  });

  it("rejects non-https and dangerous schemes", () => {
    for (const url of [
      "http://www.google.com/maps",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "vbscript:msgbox(1)",
    ]) expect(isValidMapUrl(url)).toBe(false);
  });

  it("returns false (never throws) for garbage", () => {
    expect(isValidMapUrl("not a url")).toBe(false);
    expect(isValidMapUrl("")).toBe(false);
  });
});

describe("venueMapUrl", () => {
  const base = { mapUrl: null, name: "Ace Pickle", addressLine: null, barangay: null, city: "Davao City" };

  it("passes through a valid stored owner link", () => {
    expect(venueMapUrl({ ...base, mapUrl: "https://maps.app.goo.gl/abc" }))
      .toBe("https://maps.app.goo.gl/abc");
  });

  it("falls back to a search URL for a hostile/invalid stored link", () => {
    const url = venueMapUrl({ ...base, mapUrl: "javascript:alert(1)" });
    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(url).not.toContain("javascript");
  });

  it("builds the fallback query skipping null parts and encoding special chars", () => {
    const url = venueMapUrl({ ...base, name: "A&B Courts" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("A&B Courts, Davao City"),
    );
    expect(url).not.toContain("null");
  });
});

describe("normalizeMapUrlInput", () => {
  it("returns null for blank/nullish input", () => {
    expect(normalizeMapUrlInput(undefined)).toBeNull();
    expect(normalizeMapUrlInput(null)).toBeNull();
    expect(normalizeMapUrlInput("   ")).toBeNull();
  });

  it("trims and returns a valid link", () => {
    expect(normalizeMapUrlInput("  https://maps.app.goo.gl/x  ")).toBe("https://maps.app.goo.gl/x");
  });

  it("throws ValidationError for a non-Google link", () => {
    expect(() => normalizeMapUrlInput("https://example.com")).toThrow(ValidationError);
  });
});
