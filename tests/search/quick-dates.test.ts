import { describe, expect, it } from "vitest";
import { philippineDate, quickDateChoices } from "@/lib/search-params";
describe("Philippine quick search dates", () => {
  it("uses the Philippine civil day after UTC midnight boundaries", () => {
    expect(philippineDate(new Date("2026-10-03T18:00:00Z"))).toBe("2026-10-04");
    expect(quickDateChoices("2026-10-04")).toEqual([
      { label: "Today", value: "2026-10-04" },
      { label: "Tomorrow", value: "2026-10-05" },
      { label: "This weekend", value: "2026-10-04" },
    ]);
  });
  it("finds Saturday across a month boundary and keeps a current weekend available", () => {
    expect(quickDateChoices("2026-10-30")[2].value).toBe("2026-10-31");
    expect(quickDateChoices("2026-10-31")[1].value).toBe("2026-11-01");
    expect(quickDateChoices("2026-10-31")[2].value).toBe("2026-10-31");
  });
});
