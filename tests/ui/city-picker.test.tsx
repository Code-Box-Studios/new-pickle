// @vitest-environment jsdom
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CityPicker } from "@/components/search/CityPicker";
import catalog from "@/lib/data/philippine-cities.json";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

function LocationForm() {
  const [city, setCity] = useState("Davao City");
  return <form aria-label="Court search"><label htmlFor="city">Location</label><CityPicker id="city" cities={catalog.cities} value={city} onValueChange={setCity} name="city" /></form>;
}

describe("city picker", () => {
  it("finds a city without accents and keeps the selected location in form submission", async () => {
    render(<LocationForm />);
    fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
    const search = await screen.findByPlaceholderText("Search city or province…");
    fireEvent.change(search, { target: { value: "paranaque" } });
    const option = await screen.findByRole("option", { name: /Parañaque City/ });
    fireEvent.click(option);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Location" })).toHaveTextContent("Parañaque City"));
    const form = screen.getByRole("form", { name: "Court search" }) as HTMLFormElement;
    expect(new FormData(form).get("city")).toBe("Parañaque City");
  });
});
