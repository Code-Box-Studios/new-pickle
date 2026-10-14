// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasaloThread } from "@/components/pasalo/PasaloThread";
import { PasaloDetail } from "@/components/pasalo/PasaloDetail";
import { BookingPasaloActions } from "@/components/pasalo/BookingPasaloActions";
import { PasaloMine } from "@/components/pasalo/PasaloMine";
import { BookingSummary } from "@/components/booking/BookingSummary";
import type { PasaloDetailView, PasaloThreadView } from "@/lib/pasalo/types";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const listing: PasaloThreadView["listing"] = {
  id: "listing-1", venueName: "Green Court", venueSlug: "green", courtName: "Court A",
  city: "Davao", startsAt: "2099-10-15T18:00:00.000Z", endsAt: "2099-10-15T20:00:00.000Z",
  originalPriceCents: 100000, priceCents: 75050, note: "Plans changed", status: "RESERVED", sellerName: "Seller",
};
const thread: PasaloThreadView = {
  listing,
  trade: {
    id: "trade-1", status: "RESERVED", priceCents: 75050, customerName: "Player",
    expiresAt: "2099-10-15T09:00:00.000Z", paymentSentAt: null,
    transferredAt: null, paymentReference: null,
  },
  role: "BUYER",
  payment: { channel: "GCASH", accountName: "Seller Wallet", accountNumber: "09171234567" },
  messages: [], hasOlder: false, bookingReference: null,
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("Pasalo payment and conversation", () => {
  it("lets the seller withdraw an unpaid reserved offer while keeping chat accessible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ listing, isSeller: true, myTradeId: "trade-1", canClaim: false })));
    render(<PasaloDetail listingId="listing-1" isAuthed />);
    expect(await screen.findByRole("link", { name: "Open private conversation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw offer" })).toBeInTheDocument();
  });

  it("offers relisting after withdrawal when the booking still qualifies", () => {
    render(<BookingPasaloActions bookingId="booking-1" originalPriceCents={100000} listingId="listing-1" listingStatus="WITHDRAWN" eligible />);
    fireEvent.click(screen.getByRole("button", { name: "Create Pasalo offer" }));
    expect(screen.getByRole("dialog", { name: "Offer your booking" })).toBeInTheDocument();
  });

  it("keeps all seller conversations reachable after another buyer claims", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ selling: [{ listing, tradeId: "trade-2", conversations: [
      { id: "trade-2", customerName: "New buyer", status: "RESERVED" },
      { id: "trade-1", customerName: "Previous buyer", status: "EXPIRED" },
    ] }], buying: [] })));
    render(<PasaloMine />);
    const old = await screen.findByRole("link", { name: /previous buyer/i });
    expect(old).toHaveAttribute("href", "/pasalo/trades/trade-1");
    expect(screen.getByRole("link", { name: /new buyer/i })).toHaveAttribute("href", "/pasalo/trades/trade-2");
  });

  it("shows the exact transfer price in the booking summary", () => {
    render(<BookingSummary venueName="Green Court" courtName="Court A" startsAt={new Date(listing.startsAt)} endsAt={new Date(listing.endsAt)} priceCents={75050} />);
    expect(screen.getByText("₱750.50")).toBeInTheDocument();
  });
  it("keeps seller receipt confirmation unavailable to a buyer after payment declaration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      ...thread, trade: { ...thread.trade, status: "PAYMENT_SENT", paymentSentAt: "2026-10-15T03:00:00.000Z" },
    })));
    render(<PasaloThread tradeId="trade-1" />);
    expect(await screen.findByText("Seller Wallet")).toBeInTheDocument();
    expect(screen.getByText(/waiting for.*seller/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm receipt/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /release reservation/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot automatically verify or refund direct payments/i)).toBeInTheDocument();
  });

  it("requires seller wallet receipt acknowledgement before requesting transfer", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({
      ...thread, role: "SELLER", bookingReference: "BUYER-PRIVATE", trade: { ...thread.trade, status: "PAYMENT_SENT" },
    })));
    vi.stubGlobal("fetch", fetcher);
    render(<PasaloThread tradeId="trade-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /confirm receipt/i }));
    const confirm = screen.getByRole("button", { name: "Transfer booking" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /checked my.*wallet/i }));
    expect(confirm).toBeEnabled();
    fetcher.mockResolvedValueOnce(response({ ok: true }));
    fireEvent.click(confirm);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      "/api/pasalo/trades/trade-1/transfer",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ received: true }) }),
    ));
    expect(await screen.findByText("Booking transferred.")).toBeInTheDocument();
    expect(screen.queryByText("BUYER-PRIVATE")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View your booking" })).not.toBeInTheDocument();
  });

  it("keeps payment declaration frozen even when a stale refresh still reports reserved", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response(thread)));
    vi.stubGlobal("fetch", fetcher);
    render(<PasaloThread tradeId="trade-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "I sent payment" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /sent the full transfer price/i }));
    fetcher.mockResolvedValueOnce(response({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment sent" }));
    expect(await screen.findByText(/waiting for the seller/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release reservation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I sent payment" })).not.toBeInTheDocument();
  });

  it("preserves a failed message draft and limits text to 1000 characters", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(thread));
    vi.stubGlobal("fetch", fetcher);
    render(<PasaloThread tradeId="trade-1" />);
    const draft = await screen.findByRole("textbox", { name: "Message" });
    expect(draft).toHaveAttribute("maxlength", "1000");
    fireEvent.change(draft, { target: { value: "Please confirm when it arrives." } });
    fetcher.mockResolvedValueOnce(response({ error: "Message could not be sent" }, 503));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Message could not be sent")).toBeInTheDocument();
    expect(draft).toHaveValue("Please confirm when it arrives.");
  });

  it("keeps older conversation messages accessible", async () => {
    const newer = { id: "newer", body: "Latest message", createdAt: "2026-10-15T03:10:00.000Z", sender: "SELLER", mine: false };
    const older = { id: "older", body: "Earlier message", createdAt: "2026-10-15T03:00:00.000Z", sender: "BUYER", mine: true };
    const fetcher = vi.fn().mockResolvedValue(response({ ...thread, messages: [newer], hasOlder: true }));
    vi.stubGlobal("fetch", fetcher);
    render(<PasaloThread tradeId="trade-1" />);
    const loadOlder = await screen.findByRole("button", { name: "Load older messages" });
    fetcher.mockResolvedValueOnce(response({ ...thread, messages: [older], hasOlder: false }));
    fireEvent.click(loadOlder);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      "/api/pasalo/trades/trade-1?before=newer", expect.anything(),
    ));
    expect(await screen.findByText("Earlier message")).toBeInTheDocument();
    expect(screen.getByText("Latest message")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older messages" })).not.toBeInTheDocument();
  });

  it("shows Manila booking time and exact centavos without exposing payment details publicly", async () => {
    const detail: PasaloDetailView = { listing: { ...listing, status: "ACTIVE" }, isSeller: false, myTradeId: null, canClaim: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));
    render(<PasaloDetail listingId="listing-1" isAuthed={false} />);
    expect(await screen.findByText("6:00 PM – 8:00 PM")).toBeInTheDocument();
    expect(screen.getByText("₱750.50")).toBeInTheDocument();
    expect(screen.queryByText("09171234567")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?next=%2Fpasalo%2Flisting-1");
  });
});
