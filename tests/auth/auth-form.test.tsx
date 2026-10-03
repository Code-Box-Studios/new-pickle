// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Pikol sign-in and account creation", () => {
  it.each(["login", "signup"] as const)("explains that %s is coming soon in preview", mode => {
    render(<LoginForm mode={mode} preview />);
    expect(screen.getByRole("heading", { name: "Accounts are coming soon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with email" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Pikol/ })).toHaveAttribute("href", "/search");
  });
  it("keeps the booking destination when opening account creation", () => {
    render(<LoginForm nextPath="/book/ABC?step=details" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fbook%2FABC%3Fstep%3Ddetails",
    );
  });

  it("explains expired email links and lets players request a new one", () => {
    render(<LoginForm authError="invalid" />);
    expect(screen.getByRole("alert")).toHaveTextContent("expired");
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  });

  it("offers existing players a sign-in link from account creation", () => {
    render(<LoginForm mode="signup" nextPath="/bookings" />);
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href", "/login?next=%2Fbookings",
    );
  });

  it("lets new players verify their email and correct the address afterward", async () => {
    const request = vi.fn().mockResolvedValue(respond({ ok: true }));
    vi.stubGlobal("fetch", request);
    render(<LoginForm mode="signup" nextPath="/bookings" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "player@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/api/auth/request", expect.objectContaining({
      body: JSON.stringify({ email: "player@example.com", next: "/bookings" }),
    }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Use another email" }));
    expect(screen.getByLabelText("Email address")).toHaveValue("player@example.com");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
  });

  it("shows an email delivery failure with a retry action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ error: "Please try again later." }, 429)));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "player@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByText("Please try again later.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  });

  it("lets new players verify their mobile and preserves the booking destination", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(respond({ id: "challenge-123", phone: "+639171234567", retryAfter: 60 }))
      .mockResolvedValueOnce(respond({ error: "That code is incorrect." }, 400));
    vi.stubGlobal("fetch", request);
    render(<LoginForm mode="signup" nextPath="/book/ABC" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Phone number" }), { button: 0, ctrlKey: false });
    const phone = screen.getByLabelText("Mobile number");
    expect(phone).toHaveAttribute("aria-describedby", "phone-description");
    fireEvent.change(phone, { target: { value: "09171234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue with phone" }));
    const code = await screen.findByLabelText("Verification code");
    expect(code).toHaveFocus();
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & create account" }));
    expect(await screen.findByText("That code is incorrect.")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(2, "/api/auth/phone/verify", expect.objectContaining({
      body: JSON.stringify({ challengeId: "challenge-123", code: "123456", next: "/book/ABC" }),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    expect(screen.getByLabelText("Mobile number")).toHaveValue("09171234567");
    expect(screen.getByLabelText("Mobile number")).toHaveFocus();
  });
});
