// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import {
  PayMongoPayment,
  PayMongoStatus,
} from "@/components/booking/PayMongoPayment";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});
const pending = {
  status: "PENDING" as const,
  testMode: true,
  amountCents: 40000,
  paymentReference: null,
  paidAt: null,
};
describe("hosted payment experience", () => {
  it("shows enabled methods, total and sandbox notice with no proof upload", () => {
    render(
      <PayMongoPayment
        bookingId="b"
        reference="REF"
        expiresAt={new Date(Date.now() + 600000).toISOString()}
        amountCents={40000}
        venueName="The Venue"
        methods={["gcash", "paymaya", "qrph"]}
        testMode
        checkoutEnabled
      />,
    );
    expect(
      screen.getByRole("button", { name: /Continue to secure payment/ }),
    ).toBeEnabled();
    expect(screen.getByText(/Test payment/)).toBeInTheDocument();
    expect(screen.getByText("QR Ph")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Payment screenshot"),
    ).not.toBeInTheDocument();
  });
  it("uses the stored booking ID and never submits a client supplied total", async () => {
    const send = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ next: "/bookings/REF" })),
      );
    vi.stubGlobal("fetch", send);
    render(
      <PayMongoPayment
        bookingId="b"
        reference="REF"
        expiresAt={new Date(Date.now() + 600000).toISOString()}
        amountCents={40000}
        venueName="The Venue"
        methods={["gcash"]}
        testMode
        checkoutEnabled
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to secure payment/ }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/bookings/REF"),
    );
    expect(send).toHaveBeenCalledWith(
      "/api/bookings/b/checkout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(send.mock.calls[0][1].body).toBeUndefined();
  });
  it("does not display a paid receipt just because checkout returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ checkout: pending }))),
    );
    render(<PayMongoStatus bookingId="b" initial={pending} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your payment",
    );
    await waitFor(() =>
      expect(screen.queryByText("Payment verified")).not.toBeInTheDocument(),
    );
  });
  it("stops background polling and offers an explicit retry after four checks", async () => {
    vi.useFakeTimers();
    const send = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ checkout: pending })),
      );
    vi.stubGlobal("fetch", send);
    render(<PayMongoStatus bookingId="b" initial={pending} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25000);
    });
    expect(send).toHaveBeenCalledTimes(4);
    expect(
      screen.getByRole("button", { name: "Check payment status" }),
    ).toBeEnabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(send).toHaveBeenCalledTimes(4);
  });
  it("labels late/review money without promising a confirmed reservation or refund", () => {
    render(
      <PayMongoStatus
        bookingId="b"
        initial={{ ...pending, status: "REVIEW" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Payment needs a review",
    );
    expect(screen.queryByText("Payment verified")).not.toBeInTheDocument();
  });
});
