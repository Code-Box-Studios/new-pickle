// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CourtBooking, type CourtDTO } from "@/components/court/CourtBooking";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
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
  it.each([
    { durationMinutes: 120, end: "10:00 AM", quote: 95000, total: "₱950" },
    { durationMinutes: 240, end: "12:00 PM", quote: 185000, total: "₱1,850" },
  ])("reserves a $durationMinutes-minute session in one checkout", async ({ durationMinutes, end, quote, total }) => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reference: "LONG-SESSION" })),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <CourtBooking
        {...props}
        durationMinutes={durationMinutes}
        isAuthed
        courts={[{ ...courts[0], slots: [{ ...courts[0].slots[0], priceCents: quote }] }]}
      />,
    );
    expect(screen.getByText(/Choose one start time.*one booking.*one checkout/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Center Court, 8:00 AM/ })[0]);
    const summary = document.querySelector("[data-booking-summary]") as HTMLElement;
    expect(within(summary).getByText(`Sat, Oct 3 · 8:00 AM – ${end}`)).toBeInTheDocument();
    expect(within(summary).getByText(total)).toBeInTheDocument();
    fireEvent.click(within(summary).getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/book/LONG-SESSION"));
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("/api/bookings");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toEqual({
      courtId: "center",
      startsAt: "2026-10-03T08:00:00.000Z",
      durationMinutes,
    });
  });

  it("filters midnight starts separately from morning starts", () => {
    render(<CourtBooking {...props} courts={[{
      ...courts[0],
      slots: [1, 5, 6, 23].map((hour) => ({
        startsAt: `2026-10-03T${String(hour).padStart(2, "0")}:00:00.000Z`,
        available: true,
        priceCents: 120000,
      })),
    }]} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Midnight" }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("button", { name: /Center Court, 1:00 AM/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Center Court, 6:00 AM/ })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Morning" }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("button", { name: /Center Court, 6:00 AM/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Center Court, 5:00 AM/ })).not.toBeInTheDocument();
  });

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
