// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SupabaseEmailCallback } from "@/components/auth/SupabaseEmailCallback";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("browser email callback completion", () => {
  it("removes returned credentials before exchanging them and completes sign-in once in Strict Mode", async () => {
    window.history.replaceState({ existing: true }, "", "/login?error=missing&next=%2Fbook%2FABC#access_token=fixture-access&refresh_token=fixture-refresh&type=magiclink");
    let complete!: (response: Response) => void;
    const send = vi.fn((url, init) => {
      expect(window.location.hash).toBe("");
      expect(window.location.search).toBe("?next=%2Fbook%2FABC");
      expect(window.history.state).toEqual({ existing: true });
      expect(url).toBe("/api/auth/callback");
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("same-origin");
      expect(JSON.parse(init.body)).toEqual({ access_token: "fixture-access", refresh_token: "fixture-refresh", next: "/book/ABC" });
      return new Promise<Response>(resolve => { complete = resolve; });
    });
    vi.stubGlobal("fetch", send);
    render(<StrictMode><SupabaseEmailCallback /></StrictMode>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Pikol");
    complete(new Response(JSON.stringify({ ok: true, next: "/book/ABC" })));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/book/ABC"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("handles a default email landing on the homepage", async () => {
    window.history.replaceState(null, "", "/#access_token=fixture-access&refresh_token=fixture-refresh&type=signup");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, next: "/bookings" }))));
    render(<SupabaseEmailCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bookings"));
    expect(window.location.hash).toBe("");
  });

  it.each(["#top", ""])("leaves ordinary navigation %s alone", hash => {
    window.history.replaceState(null, "", "/" + hash);
    const send = vi.fn(); vi.stubGlobal("fetch", send);
    render(<SupabaseEmailCallback />);
    expect(window.location.hash).toBe(hash);
    expect(send).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["#error=access_denied&error_code=otp_expired&error_description=private-provider-detail", "#access_token=incomplete"])("cleans rejected callbacks without submitting incomplete credentials", async hash => {
    window.history.replaceState(null, "", "/login" + hash);
    const send = vi.fn(); vi.stubGlobal("fetch", send);
    render(<SupabaseEmailCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?error=invalid"));
    expect(window.location.hash).toBe("");
    expect(send).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("private-provider-detail");
  });

  it("returns rejected sessions to sign-in without exposing provider details", async () => {
    window.history.replaceState(null, "", "/login#access_token=fixture-access&refresh_token=fixture-refresh");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "private detail" }), { status: 401 })));
    render(<SupabaseEmailCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?error=invalid"));
    expect(document.body).not.toHaveTextContent("private detail");
  });

  it("routes a recovery email through the password reset screen", async () => {
    window.history.replaceState(null, "", "/#access_token=fixture-access&refresh_token=fixture-refresh&type=recovery");
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, next: "/reset-password" })));
    vi.stubGlobal("fetch", send);
    render(<SupabaseEmailCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reset-password"));
    expect(JSON.parse(send.mock.calls[0][1].body).next).toBe("/reset-password");
  });

  it("keeps the booking return path nested inside a recovery destination", async () => {
    window.history.replaceState(null, "", "/login?next=%2Freset-password%3Fnext%3D%252Fbook%252FABC#access_token=fixture-access&refresh_token=fixture-refresh&type=recovery");
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, next: "/reset-password?next=%2Fbook%2FABC" })));
    vi.stubGlobal("fetch", send);
    render(<SupabaseEmailCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(JSON.parse(send.mock.calls[0][1].body).next).toBe("/reset-password?next=%2Fbook%2FABC");
  });
});
