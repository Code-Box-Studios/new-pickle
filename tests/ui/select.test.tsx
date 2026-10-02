// @vitest-environment jsdom
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelectField, SelectItem } from "@/components/ui/select";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function DurationForm() {
  const [value, setValue] = useState("1");
  return (
    <form aria-label="Booking">
      <label htmlFor="duration">Duration</label>
      <SelectField
        id="duration"
        name="duration"
        value={value}
        onValueChange={setValue}
      >
        <SelectItem value="1">1 hour</SelectItem>
        <SelectItem value="2">2 hours</SelectItem>
      </SelectField>
    </form>
  );
}

describe("Select menus", () => {
  it("opens a custom menu and submits the chosen value", async () => {
    render(<DurationForm />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Duration" }), {
      key: "ArrowDown",
    });
    expect(await screen.findByRole("listbox")).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "2 hours" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("2 hours"),
    );
    const form = screen.getByRole("form", {
      name: "Booking",
    }) as HTMLFormElement;
    expect(new FormData(form).get("duration")).toBe("2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
