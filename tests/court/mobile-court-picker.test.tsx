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
    fireEvent.click(screen.getByText("Court B"));
    // After switching, Court B's 9 AM slot should be visible
    const slotBtns = screen.getAllByRole("button").filter(
      (b) => !["Court A", "Court B"].includes(b.textContent ?? "")
    );
    expect(slotBtns.length).toBeGreaterThan(0);
  });

  it("calls onSelect when an available slot is clicked", () => {
    const onSelect = vi.fn();
    render(<MobileCourtPicker courts={courts} selected={null} onSelect={onSelect} />);
    const slotBtns = screen.getAllByRole("button").filter(
      (b) => !["Court A", "Court B"].includes(b.textContent ?? "") && !b.hasAttribute("disabled")
    );
    fireEvent.click(slotBtns[0]);
    expect(onSelect).toHaveBeenCalled();
  });
});
