// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import VenuePage from "@/app/(frontend)/(site)/venues/[slug]/page";

const { findVenue, availability, push } = vi.hoisted(() => ({
  findVenue: vi.fn(),
  availability: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { venue: { findFirst: findVenue } } }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/availability/engine", () => ({ venueAvailability: availability }));
vi.mock("@/lib/review", () => ({
  venueRatingSummary: vi.fn().mockResolvedValue({ avg: 0, count: 0, distribution: {} }),
  listVenueReviews: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  notFound: () => { throw new Error("Venue not found"); },
}));

const venue = {
  id: "venue", slug: "club", name: "Pikol Club", ownerId: "owner", city: "Davao City",
  isPublished: true, status: "APPROVED", photos: [], description: null,
  amenities: [], houseRules: null, addressLine: null, barangay: null,
  contactNumber: null, website: null, mapUrl: null, lat: null, lng: null,
  ratingAvg: 0, ratingCount: 0,
  courts: [{
    id: "court", name: "Court One", indoor: true, covered: true,
    surface: null, priceCents: 40000, timeRates: [],
    schedules: [{ dayOfWeek: 6, openMinute: 0, closeMinute: 1440 }],
  }],
};

beforeAll(() => {
  Element.prototype.scrollBy = () => {};
  Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
  vi.clearAllMocks();
  findVenue.mockResolvedValue(venue);
  availability.mockResolvedValue([]);
});

async function showVenue(duration: string) {
  return render(await VenuePage({
    params: Promise.resolve({ slug: "club" }),
    searchParams: Promise.resolve({ date: "2026-10-10", duration }),
  }));
}

describe("venue session duration", () => {
  it("uses synced pricing for a connected venue with earlier local rates", async () => {
    findVenue.mockResolvedValue({ ...venue, sentry: { connectionState: "CONNECTED" }, courts: [{ ...venue.courts[0], timeRates: [{
      period: "midnight", startMinute: 0, endMinute: 360, priceCents: 20000,
    }] }] });
    availability.mockResolvedValue([{ courtId: "court", slots: [{
      startsAt: new Date("2026-10-10T05:00:00Z"), available: true, priceCents: 99000,
    }] }]);
    await showVenue("120");
    expect(findVenue).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ sentry: { select: { connectionState: true } } }),
    }));
    const picker = screen.getByRole("group", { name: "Court times and prices" });
    expect(within(picker).getByText("₱400/hr")).toBeInTheDocument();
    expect(screen.queryByText(/From ₱200/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Court One, 5:00 AM/ })[0]);
    const summary = document.querySelector("[data-booking-summary]") as HTMLElement;
    expect(within(summary).getByText("₱990")).toBeInTheDocument();
  });

  it("shows the lowest configured hourly rate while preserving the full slot quote", async () => {
    findVenue.mockResolvedValue({ ...venue, courts: [{ ...venue.courts[0], timeRates: [{
      period: "midnight", startMinute: 0, endMinute: 360, priceCents: 20000,
    }] }] });
    availability.mockResolvedValue([{ courtId: "court", slots: [{
      startsAt: new Date("2026-10-10T05:00:00Z"), available: true, priceCents: 60000,
    }] }]);
    await showVenue("120");
    const picker = screen.getByRole("group", { name: "Court times and prices" });
    expect(within(picker).getByText("From ₱200/hr")).toBeInTheDocument();
    expect(screen.getByText("From ₱200 / hour")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Court One, 5:00 AM/ })[0]);
    const summary = document.querySelector("[data-booking-summary]") as HTMLElement;
    expect(within(summary).getByText("₱600")).toBeInTheDocument();
  });

  it.each(["0", "-60", "90", "721", "999999", "Infinity", "invalid"])(
    "normalizes unsupported duration %s before looking up availability",
    async (duration) => {
      await showVenue(duration);
      expect(availability).toHaveBeenCalledWith("venue", new Date("2026-10-10T00:00:00Z"), { durationMinutes: 60 });
      expect(screen.getByRole("link", { name: "1 hour" })).toHaveAttribute("aria-current", "true");
      expect(screen.getByRole("link", { name: /Back to courts/ })).toHaveAttribute("href", "/search?city=Davao%20City&date=2026-10-10&duration=60");
    },
  );

  it("keeps a longer URL selection and offers whole hour sessions through 12 hours", async () => {
    await showVenue("240");
    expect(availability).toHaveBeenCalledWith("venue", new Date("2026-10-10T00:00:00Z"), { durationMinutes: 240 });
    const group = screen.getByRole("group", { name: "Booking duration" });
    expect(within(group).getAllByRole("link")).toHaveLength(3);
    const longer = within(group).getByRole("combobox", { name: "Longer session length" });
    expect(longer).toHaveTextContent("4 hours");
    fireEvent.keyDown(longer, { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "4 hours" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("option")).toHaveLength(9);
    fireEvent.click(screen.getByRole("option", { name: "12 hours" }));
    expect(push).toHaveBeenCalledWith("/venues/club?date=2026-10-10&duration=720", { scroll: false });
    const dates = screen.getByRole("group", { name: "Choose a booking date" });
    for (const link of within(dates).getAllByRole("link")) {
      expect(link.getAttribute("href")).toContain("duration=240");
    }
  });
});
