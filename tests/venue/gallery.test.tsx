// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gallery } from "@/components/venue/Gallery";

describe("venue gallery", () => {
  it("lets a player browse every photo and wraps at the end", () => {
    render(<Gallery photos={["/first.jpg", "/second.jpg"]} name="Dink Club" />);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/second.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/first.jpg");
  });

  it("opens the chosen photo in an accessible viewer", () => {
    render(<Gallery photos={["/first.jpg", "/second.jpg"]} name="Dink Club" />);
    fireEvent.click(screen.getByRole("button", { name: "View venue photos" }));
    const viewer = screen.getByRole("dialog", { name: "Dink Club photos" });
    fireEvent.click(within(viewer).getByRole("button", { name: "Next photo" }));
    expect(within(viewer).getByRole("img")).toHaveAttribute(
      "src",
      "/second.jpg",
    );
  });
});
