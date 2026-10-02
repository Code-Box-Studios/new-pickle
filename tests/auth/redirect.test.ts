import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("local login destinations", () => {
  it("accepts the CMS and other local routes", () => {
    expect(safeNextPath("/cms")).toBe("/cms");
    expect(safeNextPath("/bookings?city=Davao%20City")).toBe(
      "/bookings?city=Davao%20City",
    );
  });
  it.each([
    "https://other.test",
    "//other.test",
    "/\\other.test",
    "/%5cother.test",
    "/%2fother.test",
    "javascript:alert(1)",
    "\n/cms",
    undefined,
    4,
    {},
  ])("rejects unsafe destination %s", (value) => {
    expect(safeNextPath(value)).toBeUndefined();
  });
});
