// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FeaturedCourtsSlideshow } from "@/components/venue/FeaturedCourtsSlideshow";

const courts = [
  { slug: "pickleview", name: "PickleView", city: "Tagum City", photo: "/one.jpg" },
  { slug: "green-court", name: "Green Court", city: "Davao City", photo: "/two.jpg" },
  { slug: "rally-club", name: "Rally Club", city: "Cebu City", photo: "/three.jpg" },
];
let reducedMotion = false;
let hidden = false;

function advance(milliseconds = 6000) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

function show() {
  return render(<FeaturedCourtsSlideshow courts={courts} isoDate="2026-09-30" />);
}

describe("Featured courts slideshow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion = false;
    hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : true,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes only the active court link and retains the booking date", () => {
    show();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toHaveAttribute("href", "/venues/pickleview?date=2026-09-30");
    expect(screen.getByRole("button", { name: "Show PickleView" })).toHaveAttribute("aria-current", "true");
  });

  it("wraps previous/next, supports direct selection, and continues autoplay afterward", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Previous court" }));
    expect(screen.getByRole("link", { name: "View Rally Club in Cebu City" })).toBeInTheDocument();
    advance(300);
    fireEvent.click(screen.getByRole("button", { name: "Next court" }));
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    advance(300);
    fireEvent.click(screen.getByRole("button", { name: "Show Green Court" }));
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
    advance();
    expect(screen.getByRole("link", { name: "View Rally Club in Cebu City" })).toBeInTheDocument();
  });

  it("autoplays without exposing play or pause buttons", () => {
    show();
    expect(screen.queryByRole("button", { name: /play slideshow|pause slideshow/i })).not.toBeInTheDocument();
    advance();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
    advance();
    expect(screen.getByRole("link", { name: "View Rally Club in Cebu City" })).toBeInTheDocument();
  });

  it("temporarily pauses on hover and resumes after the pointer leaves", () => {
    show();
    const slideshow = screen.getByRole("region", { name: "Featured courts" });
    fireEvent.mouseEnter(slideshow);
    advance(12000);
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    fireEvent.mouseLeave(slideshow);
    advance();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
  });

  it("loops back to the first court and continues rotating", () => {
    show();
    advance();
    advance();
    advance();
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    advance(300);
    advance();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
  });

  it("pauses while keyboard focus is inside and resumes when it leaves", () => {
    show();
    const link = screen.getByRole("link", { name: "View PickleView in Tagum City" });
    fireEvent.focus(link);
    advance(12000);
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    fireEvent.blur(link);
    advance();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
  });

  it("defaults to manual navigation when reduced motion is requested", () => {
    reducedMotion = true;
    show();
    advance(12000);
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next court" }));
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
  });

  it("suspends rotation in a hidden tab without skipping courts on return", () => {
    show();
    hidden = true;
    fireEvent(document, new Event("visibilitychange"));
    advance(18000);
    hidden = false;
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    advance();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
  });

  it("supports arrow-key navigation without intercepting browser shortcuts", () => {
    show();
    const slideshow = screen.getByRole("region", { name: "Featured courts" });
    fireEvent.keyDown(slideshow, { key: "ArrowRight" });
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
    fireEvent.keyDown(slideshow, { key: "ArrowLeft", altKey: true });
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toBeInTheDocument();
    fireEvent.keyDown(slideshow, { key: "ArrowLeft" });
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
  });

  it("keeps a single court usable without unnecessary slideshow controls", () => {
    render(<FeaturedCourtsSlideshow courts={[courts[0]]} isoDate="2026-09-30" />);
    advance(12000);
    expect(screen.getByRole("link", { name: "View PickleView in Tagum City" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retains focus on the venue link when arrow keys change the court", () => {
    show();
    const link = screen.getByRole("link", { name: "View PickleView in Tagum City" });
    act(() => link.focus());
    fireEvent.keyDown(link, { key: "ArrowRight" });
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "View Green Court in Davao City" })).toHaveAttribute("href", "/venues/green-court?date=2026-09-30");
  });

  it("renders nothing when there are no court photos", () => {
    render(<FeaturedCourtsSlideshow courts={[]} isoDate="2026-09-30" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
