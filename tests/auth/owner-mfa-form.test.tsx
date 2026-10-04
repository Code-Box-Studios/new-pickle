// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OwnerMfaForm } from "@/components/auth/OwnerMfaForm";
import { OwnerLoginForm } from "@/components/auth/OwnerLoginForm";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("venue workspace sign-in", () => {
  it("explains the separate owner sign-in and authenticator step", () => {
    render(<OwnerLoginForm nextPath="/owner" />);
    expect(screen.getByRole("heading", { name: "Your venue workspace" })).toBeInTheDocument();
    expect(screen.getByText(/authenticator/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  });

  it("starts setup only after the owner explicitly requests it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ factors: [] })).mockResolvedValueOnce(response({ id: "new-factor", qrCode: "data:image/svg+xml;utf-8,qr", secret: "MANUALKEY" })));
    render(<OwnerMfaForm nextPath="/owner/venues/one/details" />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByAltText("Scan this QR code with your authenticator app")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Authenticator setup" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Use a setup key instead" }));
    expect(screen.getByText("MANUALKEY")).toBeInTheDocument();
  });

  it("shows the existing authenticator choice without enrolling another", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ factors: [{ id: "phone", name: "My phone" }, { id: "backup", name: "Backup device" }] })));
    render(<OwnerMfaForm nextPath="/owner" />);
    expect(await screen.findByLabelText("Authenticator code")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Authenticator" })).toHaveTextContent("My phone");
    expect(screen.queryByRole("button", { name: "Set up authenticator" })).not.toBeInTheDocument();
  });

  it("keeps the owner on the code form when verification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ factors: [{ id: "factor", name: "Phone" }] })).mockResolvedValueOnce(response({ error: "That code is incorrect or expired." }, 400)));
    render(<OwnerMfaForm nextPath="/owner" />);
    fireEvent.change(await screen.findByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & open workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    expect(screen.getByLabelText("Authenticator code")).toHaveAttribute("aria-invalid", "true");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Verify & open workspace" })).toBeEnabled();
  });

  it("lets the owner retry a failed status request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response({ factors: [] })));
    render(<OwnerMfaForm nextPath="/owner" />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Set up authenticator" })).toBeEnabled();
  });

  it("returns to venue setup after a successful verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ factors: [{ id: "factor", name: "Phone" }] })).mockResolvedValueOnce(response({ ok: true, next: "/owner/venues/one/details" })));
    render(<OwnerMfaForm nextPath="/owner/venues/one/details" />);
    fireEvent.change(await screen.findByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & open workspace" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/owner/venues/one/details"));
    expect(router.refresh).toHaveBeenCalled();
  });
});
