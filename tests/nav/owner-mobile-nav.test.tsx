// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/owner",
}));

const session = { email: "owner@test.com" };

describe("OwnerMobileNav", () => {
  it("renders the four bottom tab items", () => {
    render(<OwnerMobileNav session={session} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Reservations")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("opens the More sheet when More tab is tapped", () => {
    render(<OwnerMobileNav session={session} />);
    fireEvent.click(screen.getByText("More"));
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Venues")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("closes the More sheet when a link inside is clicked", () => {
    render(<OwnerMobileNav session={session} />);
    fireEvent.click(screen.getByText("More"));
    fireEvent.click(screen.getByText("Reviews"));
    // Sheet content should disappear
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });
});
