// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
  it("groups starts before 6 AM under midnight", () => {
    render(<ScheduleGrid courts={[{ ...courts[0], slots: [makeSlot(5), makeSlot(6)] }]} selected={null} onSelect={() => {}} />);
    const midnight = screen.getByText("Midnight").parentElement?.parentElement as HTMLElement;
    expect(within(midnight).getByRole("button", { name: /5:00 AM/ })).toBeInTheDocument();
    expect(within(midnight).queryByRole("button", { name: /6:00 AM/ })).not.toBeInTheDocument();
  });

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
    const available = screen.getByRole("button", { name: /Court 1.*8:00 AM.*₱300/ });
    fireEvent.click(available);
    expect(onSelect).toHaveBeenCalledWith(
      courts[0],
      courts[0].slots[0],
    );
  });

  it("disables unavailable slots", () => {
    render(<ScheduleGrid courts={courts} selected={null} onSelect={() => {}} />);
    const unavailable = screen.getByRole("button", { name: /Court 1.*9:00 AM.*unavailable/i });
    expect(unavailable).toBeDisabled();
  });

  it("applies selected style to the selected slot", () => {
    const sel = { courtId: "c1", startsAt: courts[0].slots[0].startsAt, courtName: "Court 1", priceCents: 30000 };
    render(<ScheduleGrid courts={courts} selected={sel} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Court 1.*8:00 AM.*₱300/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Court 2.*8:00 AM.*₱300/, pressed: false })).toBeInTheDocument();
  });
});
