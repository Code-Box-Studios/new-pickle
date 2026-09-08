// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";

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
});
