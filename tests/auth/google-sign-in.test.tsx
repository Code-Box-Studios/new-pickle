// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Google sign-in", () => {
  it.each(["login", "signup"] as const)("starts Google %s for players and preserves the booking", async mode => {
    const url = "https://project.supabase.co/auth/v1/authorize?provider=google";
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, url })));
    vi.stubGlobal("fetch", send);
    render(<LoginForm mode={mode} nextPath="/book/ABC" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeDisabled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(url));
    expect(send).toHaveBeenCalledWith("/api/auth/google", expect.objectContaining({
      method: "POST", body: JSON.stringify({ next: "/book/ABC", audience: "player" }),
    }));
  });

  it("keeps Google failure retryable and sends the venue audience", async () => {
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }));
    vi.stubGlobal("fetch", send);
    render(<LoginForm audience="owner" nextPath="/owner/venues" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Google sign-in/);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(send).toHaveBeenCalledWith("/api/auth/google", expect.objectContaining({
      body: JSON.stringify({ next: "/owner/venues", audience: "owner" }),
    }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("offers retry after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Google sign-in/);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it("keeps Google unavailable in public preview", () => {
    render(<LoginForm preview />);
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });
});
