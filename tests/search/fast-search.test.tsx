// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchBar } from "@/components/search/SearchBar";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => vi.clearAllMocks());
const props = {
  cities: [
    { name: "Davao City", value: "Davao City", province: "Davao del Sur" },
  ],
  defaultCity: "Davao City",
  defaultDate: "2026-10-05",
  todayDate: "2026-10-04",
};
describe("quick court search", () => {
  it("keeps optional filters out of the primary flow and submits a quick date with sensible defaults", () => {
    render(<SearchBar {...props} />);
    expect(
      screen.getByRole("button", { name: /Time & duration/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("combobox", { name: "Time" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Find courts" }));
    expect(push).toHaveBeenCalledWith(
      "/search?city=Davao+City&date=2026-10-04&time=any&duration=60",
    );
  });
  it("exposes URL-selected filters and can reset them without changing the selected city/date", () => {
    render(
      <SearchBar {...props} defaultTime="evening" defaultDuration="120" />,
    );
    expect(
      screen.getByRole("button", { name: /Time & duration/ }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Find courts" }));
    expect(push).toHaveBeenCalledWith(
      "/search?city=Davao+City&date=2026-10-05&time=any&duration=60",
    );
  });
});
