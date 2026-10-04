// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";
import { PasswordRecoveryForm, PasswordResetForm } from "@/components/auth/PasswordRecoveryForm";
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("password forms for players and venue owners", () => {
  it.each(["player", "owner"] as const)("offers email and password by default for %s", audience => {
    render(<LoginForm audience={audience} nextPath="/owner" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password?next=%2Fowner");
  });
  it("sends passwords only to the server and returns to the requested page", async () => {
    const send = vi.fn().mockResolvedValue(response({ ok: true, next: "/book/ABC" })); vi.stubGlobal("fetch", send);
    render(<LoginForm nextPath="/book/ABC" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/book/ABC"));
    expect(send).toHaveBeenCalledWith("/api/auth/password", expect.objectContaining({ body: JSON.stringify({ action: "login", email: "player@example.com", password: "password123!", next: "/book/ABC" }) }));
  });
  it("asks new password accounts to confirm their email without signing them in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true, confirmationRequired: true })));
    render(<LoginForm mode="signup" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Confirm your email" })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("shows credential errors and keeps retry available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Email or password is incorrect." }, 401)));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "incorrect" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("keeps the email link method available", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Use an email link instead" }));
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeInTheDocument();
  });
  it("allows existing accounts to request a reset without exposing account existence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true })));
    render(<PasswordRecoveryForm nextPath="/owner" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If this email has a Pikol account");
  });
  it("requires matching passwords before submitting a reset", async () => {
    const send = vi.fn(); vi.stubGlobal("fetch", send);
    render(<PasswordResetForm nextPath="/owner" />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new password123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("match");
    expect(send).not.toHaveBeenCalled();
  });
});
