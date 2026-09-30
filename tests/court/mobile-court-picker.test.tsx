// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileCourtPicker } from "@/components/court/MobileCourtPicker";
import type { CourtDTO } from "@/components/court/CourtBooking";

function makeSlot(hour: number, available = true) {
  const d = new Date("2026-09-15T00:00:00Z");
  d.setUTCHours(hour);
  return { startsAt: d.toISOString(), available, priceCents: 30000 };
}

const courts: CourtDTO[] = [
  {
    id: "c1",
    name: "Court A",
    indoor: true,
    covered: false,
    surface: null,
    priceCents: 30000,
    slots: [makeSlot(8), makeSlot(13, false)],
  },
  {
    id: "c2",
    name: "Court B",
    indoor: false,
    covered: false,
    surface: null,
    priceCents: 25000,
    slots: [makeSlot(9)],
  },
];

describe("MobileCourtPicker", () => {
  it("renders court selector chips", () => {
    render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Court A")).toBeInTheDocument();
    expect(screen.getByText("Court B")).toBeInTheDocument();
  });

  it("shows slots for the active court", () => {
    render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
    // Court A is first/default; its 8 AM slot should be visible
    expect(screen.getAllByRole("button").length).toBeGreaterThan(2); // chips + at least 1 slot
  });

  it("switches to Court B slots when its chip is clicked", () => {
    render(<MobileCourtPicker courts={courts} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Court A", pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Court B", pressed: false }));
    expect(screen.getByRole("button", { name: "Court B", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Court A", pressed: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Court B.*9:00 AM.*₱300/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Court A.*8:00 AM/ })).not.toBeInTheDocument();
  });

  it("calls onSelect when an available slot is clicked", () => {
    const onSelect = vi.fn();
    render(<MobileCourtPicker courts={courts} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Court A.*8:00 AM.*₱300/ }));
    expect(onSelect).toHaveBeenCalledWith(courts[0], courts[0].slots[0]);
  });

  it("announces the selected slot and prevents choosing an unavailable time", () => {
    const onSelect = vi.fn();
    const selected = { courtId: "c1", startsAt: courts[0].slots[0].startsAt, courtName: "Court A", priceCents: 30000 };
    render(<MobileCourtPicker courts={courts} selected={selected} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Court A.*8:00 AM.*₱300/, pressed: true })).toBeInTheDocument();
    const unavailable = screen.getByRole("button", { name: /Court A.*1:00 PM.*unavailable/i });
    expect(unavailable).toBeDisabled();
    fireEvent.click(unavailable);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
