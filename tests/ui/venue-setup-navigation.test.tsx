// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { StepRail } from "@/components/venue-admin/StepRail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/owner/venues/venue-1/hours",
}));
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("compact venue setup navigation", () => {
  it("shows the current step and offers every setup destination without a horizontal rail", async () => {
    render(
      <StepRail venueId="venue-1" done={{ details: true, photos: true }} />,
    );
    const trigger = screen.getByRole("button", {
      name: "Choose setup step: Hours, step 4 of 6",
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Choose a setup step",
    });
    expect(within(dialog).getAllByRole("link")).toHaveLength(6);
    const current = within(dialog).getByRole("link", { name: /Hours/ });
    expect(current).toHaveAttribute("aria-current", "step");
    expect(current).toHaveAttribute("href", "/owner/venues/venue-1/hours");
    expect(
      within(dialog).getByRole("link", { name: /Review/ }),
    ).toHaveAttribute("href", "/owner/venues/venue-1/review");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
