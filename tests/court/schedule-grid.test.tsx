// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleGrid } from "@/components/court/ScheduleGrid";
import type { CourtDTO } from "@/components/court/CourtBooking";

function makeSlot(hour: number, available = true) {
  const d = new Date("2026-09-15T00:00:00Z");
  d.setUTCHours(hour);
  return { startsAt: d.toISOString(), available, priceCents: 30000 };
}

const courts: CourtDTO[] = [
  {
    id: "c1",
    name: "Court 1",
    indoor: true,
    covered: true,
    surface: "Hardcourt",
    priceCents: 30000,
    slots: [makeSlot(8), makeSlot(9, false), makeSlot(13)],
  },
  {
    id: "c2",
    name: "Court 2",
    indoor: false,
    covered: false,
    surface: null,
    priceCents: 25000,
    slots: [makeSlot(8), makeSlot(18)],
  },
];

describe("ScheduleGrid", () => {
  it("renders court column headers", () => {
    render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Court 1")).toBeInTheDocument();
    expect(screen.getByText("Court 2")).toBeInTheDocument();
  });

  it("renders band labels", () => {
    render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Afternoon")).toBeInTheDocument();
    expect(screen.getByText("Evening")).toBeInTheDocument();
  });

  it("calls onSelect with correct court and slot when available cell clicked", () => {
    const onSelect = vi.fn();
    render(<ScheduleGrid courts={courts} selected={null} onSelect={onSelect} />);
    // The 8:00 AM slot for Court 1 should be clickable
    const buttons = screen.getAllByRole("button");
    const available = buttons.find((b) => !b.hasAttribute("disabled") && b.textContent?.includes("8:00"));
    expect(available).toBeDefined();
    fireEvent.click(available!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1" }),
      expect.objectContaining({ available: true })
    );
  });

  it("disables unavailable slots", () => {
    render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    const disabled = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(disabled.length).toBeGreaterThan(0);
  });

  it("applies selected style to the selected slot", () => {
    const sel = { courtId: "c1", startsAt: courts[0].slots[0].startsAt, courtName: "Court 1", priceCents: 30000 };
    render(<ScheduleGrid courts={courts} selected={sel} onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    const selBtn = buttons.find((b) => b.getAttribute("aria-pressed") === "true");
    expect(selBtn).toBeDefined();
  });
});
