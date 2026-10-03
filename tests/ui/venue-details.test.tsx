// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DetailsForm } from "@/components/venue-admin/DetailsForm";

const { push, refresh, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));

const initial = {
  name: "My venue",
  description: null,
  addressLine: null,
  barangay: "Agdao",
  city: "Davao City",
  contactNumber: null,
  website: null,
  mapUrl: null,
  houseRules: null,
  amenities: [],
};
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => vi.clearAllMocks());

describe("venue details saving", () => {
  it("saves a draft without advancing and submits the current fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetcher);
    render(<DetailsForm venueId="venue-1" initial={initial} locked={false} />);
    fireEvent.change(screen.getByLabelText("Venue name"), {
      target: { value: "Pikol Park" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(fetcher.mock.calls[0][0]).toBe("/api/owner/venues/venue-1");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      name: "Pikol Park",
      city: "Davao City",
    });
    await screen.findByText("All changes saved");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Venue name")).toHaveValue("Pikol Park");
  });

  it("keeps edits after a failed save and advances only after a successful retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Please try again" }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetcher);
    render(<DetailsForm venueId="venue-1" initial={initial} locked={false} />);
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A place for every player." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    expect(screen.getByLabelText("Description")).toHaveValue(
      "A place for every player.",
    );
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/owner/venues/venue-1/photos"),
    );
  });

  it("offers nationwide city search and clears the previous city's barangay", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetcher);
    render(<DetailsForm venueId="venue-1" initial={initial} locked={false} />);
    fireEvent.click(screen.getByRole("combobox", { name: "City" }));
    fireEvent.change(
      await screen.findByPlaceholderText("Search city or province…"),
      { target: { value: "paranaque" } },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Parañaque City/ }),
    );
    expect(screen.getByLabelText("Barangay")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      city: "Parañaque City",
      barangay: null,
    });
  });
});
