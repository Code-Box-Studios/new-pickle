// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PaymentStep } from "@/components/booking/PaymentStep";
import { PhotoManager } from "@/components/venue-admin/PhotoManager";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());

function oversizedImage() {
  return new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
    type: "image/png",
  });
}

describe("upload size feedback", () => {
  it("explains an oversized payment screenshot immediately", () => {
    render(
      <PaymentStep
        bookingId="booking-1"
        reference="PK-TEST"
        expiresAt="2050-01-01T00:00:00Z"
        amountCents={40000}
        venueName="Test venue"
        methods={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Payment screenshot"), {
      target: { files: [oversizedImage()] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Image is too large");
    expect(screen.queryByText("large.png")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Payment screenshot"), {
      target: { files: [new File(["image"], "receipt.png", { type: "image/png" })] },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
  });

  it("shows an actionable error instead of submitting an oversized venue photo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ photos: ["venue-media/photo.png"] })),
    ));
    render(
      <ToastProvider>
        <PhotoManager venueId="venue-1" initial={[]} locked={false} />
      </ToastProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Upload a photo/), {
      target: { files: [oversizedImage()] },
    });
    expect(await screen.findByText(/Image is too large/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });
});
