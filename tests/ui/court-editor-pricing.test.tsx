// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourtEditor } from "@/components/venue-admin/CourtEditor";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
const court = {
  id: "court-1",
  name: "Court 1",
  indoor: true,
  covered: false,
  surface: null,
  capacity: 4,
  priceCents: 40050,
  active: true,
};

function show(pricingLocked = false) {
  return render(
    <ToastProvider>
      <CourtEditor
        venueId="venue-1"
        courts={[court]}
        locked={false}
        pricingLocked={pricingLocked}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("{}", { headers: { "Content-Type": "application/json" } }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("owner court time rates", () => {
  it("preserves centavos and submits customized time bands", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Edit court" }));
    expect(screen.getByLabelText("Base price / hour (₱)")).toHaveValue(400.5);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Different rates by time of day" }),
    );
    fireEvent.change(screen.getByLabelText("Afternoon price / hour (₱)"), {
      target: { value: "550.75" },
    });
    fireEvent.change(screen.getByLabelText("Afternoon ends"), {
      target: { value: "16:30" },
    });
    fireEvent.change(screen.getByLabelText("Evening starts"), {
      target: { value: "16:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const request = vi.mocked(fetch).mock.calls[0][1];
    const payload = JSON.parse(String(request?.body));
    expect(payload.priceCents).toBe(40050);
    expect(payload.timeRates).toContainEqual({
      period: "afternoon",
      startMinute: 720,
      endMinute: 990,
      priceCents: 55075,
    });
    expect(payload.timeRates).toContainEqual({
      period: "evening",
      startMinute: 990,
      endMinute: 1440,
      priceCents: 40050,
    });
  });

  it("keeps Sentry pricing disabled while allowing court metadata edits", async () => {
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "Edit court" }));
    expect(screen.getByLabelText("Base price / hour (₱)")).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Different rates by time of day" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Court name"), {
      target: { value: "Renamed court" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.name).toBe("Renamed court");
    expect(payload).not.toHaveProperty("priceCents");
    expect(payload).not.toHaveProperty("timeRates");
  });
});
