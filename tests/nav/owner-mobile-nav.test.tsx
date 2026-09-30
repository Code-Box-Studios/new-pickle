// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";

const route = vi.hoisted(() => ({ pathname: "/owner" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

const session = { email: "owner@test.com" };

describe("OwnerMobileNav", () => {
  beforeEach(() => {
    route.pathname = "/owner";
  });

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

  it("identifies Reservations as current on a reservation detail route", () => {
    route.pathname = "/owner/reservations/RP-123";
    render(<OwnerMobileNav session={session} />);
    expect(screen.getByRole("link", { name: "Reservations" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the active venue in navigation destinations", () => {
    render(<OwnerMobileNav session={session} activeVenueId="venue-123" />);
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/owner/calendar?venue=venue-123");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("link", { name: "Venues" })).toHaveAttribute("href", "/owner/venues?venue=venue-123");
  });

  it("dismisses More with Escape and returns focus to its trigger", async () => {
    render(<OwnerMobileNav session={session} />);
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "More" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
