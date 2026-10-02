// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourtBooking, type CourtDTO } from "@/components/court/CourtBooking";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const courts: CourtDTO[] = [
  {
    id: "center",
    name: "Center Court",
    indoor: true,
    covered: true,
    surface: "Hardcourt",
    priceCents: 40000,
    slots: [8, 13, 18].map((hour) => ({
      startsAt: `2026-10-03T${String(hour).padStart(2, "0")}:00:00.000Z`,
      available: true,
      priceCents: 120000,
    })),
  },
];
const props = {
  courts,
  durationMinutes: 180,
  isAuthed: false,
  returnTo: "/venues/club?date=2026-10-03&duration=180",
  selectedDateLabel: "Sat, Oct 3",
};

describe("court booking controls", () => {
  it("clears the chosen slot when switching to another court on a phone", () => {
    render(
      <CourtBooking
        {...props}
        courts={[...courts, { ...courts[0], id: "second", name: "Court Two" }]}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Center Court, 8:00 AM/ })[0],
    );
    expect(
      screen.getByRole("button", { name: "Clear selection" }),
    ).toBeInTheDocument();
    const picker = screen.getByRole("group", { name: "Choose a court" });
    fireEvent.click(within(picker).getByRole("button", { name: "Court Two" }));
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).not.toBeInTheDocument();
  });
  it("filters times by the selected part of the day", () => {
    render(<CourtBooking {...props} />);
    const afternoon = screen.getByRole("tab", { name: "Afternoon" });
    fireEvent.mouseDown(afternoon, { button: 0, ctrlKey: false });
    expect(
      screen.getAllByRole("button", { name: /Center Court, 1:00 PM/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Center Court, 8:00 AM/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Center Court, 6:00 PM/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the whole session and lets a player clear their choice", () => {
    render(<CourtBooking {...props} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Center Court, 8:00 AM/ })[0],
    );
    expect(screen.getByText(/8:00 AM – 11:00 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(
      screen.queryByRole("button", { name: /Continue/ }),
    ).not.toBeInTheDocument();
  });
});
