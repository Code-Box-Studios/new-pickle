import { describe, expect, it } from "vitest";
import { resolveTimeWindow } from "@/lib/search-params";

describe("search time windows", () => {
  it("keeps midnight separate from morning and includes the last evening hour", () => {
    expect(resolveTimeWindow("midnight")).toEqual({ from: 0, to: 360 });
    expect(resolveTimeWindow("morning")).toEqual({ from: 360, to: 720 });
    expect(resolveTimeWindow("evening")).toEqual({ from: 1020, to: 1440 });
  });
});
