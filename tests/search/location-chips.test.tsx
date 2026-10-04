// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SearchBar } from "@/components/search/SearchBar";
import { PHILIPPINE_CITIES } from "@/lib/cities";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const props = {
  cities: PHILIPPINE_CITIES,
  defaultCity: "Davao City",
  defaultDate: "2026-10-05",
  todayDate: "2026-10-04",
  defaultTime: "evening",
  defaultDuration: "240",
};
let success: PositionCallback;
let failure: PositionErrorCallback;
const getCurrentPosition = vi.fn(
  (ok: PositionCallback, fail: PositionErrorCallback) => {
    success = ok;
    failure = fail;
  },
);
function locateCebu() {
  act(() =>
    success({
      coords: { latitude: 10.31672, longitude: 123.89071, accuracy: 20 },
      timestamp: Date.now(),
    } as GeolocationPosition),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
});
afterEach(cleanup);

describe("search location shortcuts", () => {
  it("uses a date changed while location is being found", async () => {
    render(<SearchBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    locateCebu();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/search?city=Cebu+City&date=2026-10-04&time=evening&duration=240",
      ),
    );
  });

  it("keeps manual search usable without browser geolocation support", () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    render(<SearchBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/choose a city/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for location only after a click and fills the city without submitting", async () => {
    render(<SearchBar {...props} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Current location" }));
    expect(
      screen.getByRole("button", { name: "Current location" }),
    ).toBeDisabled();
    locateCebu();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Location" }),
      ).toHaveTextContent("Cebu City"),
    );
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Search courts in Mandaue City" }),
    ).toBeInTheDocument();
  });

  it("Near me searches the closest city in one click and preserves booking filters", async () => {
    render(<SearchBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    locateCebu();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/search?city=Cebu+City&date=2026-10-05&time=evening&duration=240",
      ),
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("searches a suggested city without requesting device location", () => {
    render(<SearchBar {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Search courts in Panabo City" }),
    );
    expect(push).toHaveBeenCalledWith(
      "/search?city=Panabo+City&date=2026-10-05&time=evening&duration=240",
    );
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])(
    "keeps manual search usable after geolocation error %i",
    async (code) => {
      render(<SearchBar {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Near me" }));
      act(() =>
        failure({
          code,
          message: "Location error",
        } as GeolocationPositionError),
      );
      expect(screen.getByRole("alert")).toHaveTextContent(/choose a city/i);
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Find courts" }));
      expect(push).toHaveBeenCalledWith(
        "/search?city=Davao+City&date=2026-10-05&time=evening&duration=240",
      );
    },
  );

  it("does not search an arbitrary Philippine city for a location abroad", () => {
    render(<SearchBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    act(() =>
      success({
        coords: { latitude: 51.5, longitude: -0.12, accuracy: 20 },
        timestamp: Date.now(),
      } as GeolocationPosition),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/choose a city/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("retains city suggestions after search remount without persisting GPS coordinates", async () => {
    const { unmount } = render(<SearchBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Current location" }));
    locateCebu();
    unmount();
    render(<SearchBar {...props} defaultCity="Cebu City" />);
    await waitFor(() =>
      expect(screen.getByText(/Near Cebu City/)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    expect(push).toHaveBeenCalledWith(
      "/search?city=Cebu+City&date=2026-10-05&time=evening&duration=240",
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const saved = Object.values(sessionStorage).join(" ");
    expect(saved).not.toContain("10.31672");
    expect(saved).not.toContain("123.89071");
  });
});
