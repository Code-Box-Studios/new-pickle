// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DatePicker } from "@/components/ui/date-picker";

function BookingDate() {
  const [date, setDate] = useState("2026-10-03");
  return (
    <form aria-label="Court search">
      <label htmlFor="play-date">Date</label>
      <DatePicker
        id="play-date"
        name="date"
        value={date}
        onValueChange={setDate}
      />
    </form>
  );
}

describe("date picker", () => {
  it("prevents choosing a date before the booking window", async () => {
    render(
      <DatePicker
        aria-label="Booking day"
        value="2026-10-03"
        minDate="2026-10-03"
        onValueChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Booking day" }));
    expect(
      await screen.findByRole("button", { name: /Friday, October 2nd, 2026/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Sunday, October 4th, 2026/ }),
    ).toBeEnabled();
  });
  it("chooses a date from the custom calendar and preserves the ISO form value", async () => {
    render(<BookingDate />);
    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    const day = await screen.findByRole("button", {
      name: /Sunday, October 4th, 2026/,
    });
    fireEvent.click(day);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent(
        "Oct 4, 2026",
      ),
    );
    const form = screen.getByRole("form", {
      name: "Court search",
    }) as HTMLFormElement;
    expect(new FormData(form).get("date")).toBe("2026-10-04");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
