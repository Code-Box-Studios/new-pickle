// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ShareToPhonePanel", () => {
  it("shows the trigger button, then the QR after clicking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "http://172.16.14.20:3000",
          qrDataUrl: "data:image/png;base64,AAAA",
          candidates: [
            {
              iface: "Wi-Fi",
              address: "172.16.14.20",
              url: "http://172.16.14.20:3000",
              qrDataUrl: "data:image/png;base64,AAAA",
            },
          ],
        }),
      })),
    );

    render(<ShareToPhonePanel />);

    // (1) Trigger button must be present
    const trigger = screen.getByRole("button", { name: /share to phone/i });
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger);

    // (2) After click + fetch, QR image and URL text must appear
    const img = await screen.findByRole("img", { name: /qr/i });
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");

    await waitFor(() => {
      expect(screen.queryByText("http://172.16.14.20:3000")).not.toBeNull();
    });
  });

  it("shows an error message and a Try again button when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    render(<ShareToPhonePanel />);

    fireEvent.click(screen.getByRole("button", { name: /share to phone/i }));

    // Error message surfaces (panel opens instead of staying silently closed)
    await waitFor(() => {
      expect(
        screen.queryByText(/couldn't reach the dev share endpoint/i),
      ).not.toBeNull();
    });

    // The spec-promised retry
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeTruthy();
  });

  it("switches candidates from cache without a second fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        url: "http://172.16.14.20:3000",
        qrDataUrl: "data:image/png;base64,AAAA",
        candidates: [
          {
            iface: "Wi-Fi",
            address: "172.16.14.20",
            url: "http://172.16.14.20:3000",
            qrDataUrl: "data:image/png;base64,AAAA",
          },
          {
            iface: "Ethernet",
            address: "10.0.0.5",
            url: "http://10.0.0.5:3000",
            qrDataUrl: "data:image/png;base64,BBBB",
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShareToPhonePanel />);

    fireEvent.click(screen.getByRole("button", { name: /share to phone/i }));

    // First candidate is shown initially
    const img = await screen.findByRole("img", { name: /qr/i });
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");

    // A picker (combobox) renders because there are 2 candidates
    const select = screen.getByRole("combobox");
    expect(select).toBeTruthy();

    // Switch to the second candidate
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: /Ethernet/ }));

    // QR image src and URL text update to the second candidate from cache
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /qr/i }).getAttribute("src"),
      ).toBe("data:image/png;base64,BBBB");
      expect(screen.queryByText("http://10.0.0.5:3000")).not.toBeNull();
    });

    // No second fetch — the switch re-renders from cached candidates
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hides the button for the session when dismissed", () => {
    render(<ShareToPhonePanel />);

    // Trigger is present initially
    expect(
      screen.getByRole("button", { name: /share to phone/i }),
    ).toBeTruthy();

    // Dismiss it (the small "Hide" control next to the trigger)
    fireEvent.click(screen.getByRole("button", { name: /^hide$/i }));

    // Component now renders nothing — both controls are gone until reload
    expect(
      screen.queryByRole("button", { name: /share to phone/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^hide$/i })).toBeNull();
  });
});
