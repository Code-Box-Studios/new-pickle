// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button compatibility", () => {
  it("blocks duplicate submission while loading", () => {
    const submit = vi.fn();
    render(
      <Button loading onClick={submit}>
        Reserve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Reserve" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps a slotted navigation action a link", () => {
    render(
      <Button asChild>
        <a href="/search">Explore courts</a>
      </Button>,
    );
    expect(
      screen.getByRole("link", { name: "Explore courts" }),
    ).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables a slotted link while loading", () => {
    const navigate = vi.fn();
    render(
      <Button asChild loading>
        <a href="/search" onClick={navigate}>
          Explore courts
        </a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Explore courts" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    fireEvent.click(link);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("blocks the parent callback on a disabled slotted link", () => {
    const navigate = vi.fn();
    render(
      <Button asChild loading onClick={navigate}>
        <a href="/search">Find courts</a>
      </Button>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Find courts" }));
    expect(navigate).not.toHaveBeenCalled();
  });
});
