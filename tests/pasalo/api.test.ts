import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma, resetDb } from "../db";
import { seedConfirmedBooking, seedCustomer } from "../factories";
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
import { getSession } from "@/lib/auth/session";
import { POST as create, GET as market } from "@/app/api/pasalo/route";
import { POST as action, GET as read } from "@/app/api/pasalo/[...path]/route";

beforeEach(async () => { await resetDb(); vi.clearAllMocks(); vi.mocked(getSession).mockResolvedValue(null); });
function request(path: string, body: unknown, origin = "http://localhost") { return new NextRequest(`http://localhost/api/pasalo/${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
function params(path: string) { return { params: Promise.resolve({ path: path.split("/") }) }; }

describe("Pasalo HTTP access", () => {
  it("allows public discovery but requires a session and same-origin writes", async () => {
    expect((await market(new NextRequest("http://localhost/api/pasalo"))).status).toBe(200);
    expect((await create(request("", {}))).status).toBe(401);
    const u = await seedCustomer();
    vi.mocked(getSession).mockResolvedValue({ id: u.id, email: u.email, role: "CUSTOMER" });
    expect((await create(request("", {}, "https://attacker.example"))).status).toBe(403);
    expect((await create(request("", {}))).status).toBe(400);
    const bad = new NextRequest("http://localhost/api/pasalo", { method: "POST", headers: { origin: "http://localhost" }, body: "{" });
    expect((await create(bad)).status).toBe(400);
    expect((await create(request("", { note: "x".repeat(13000) }))).status).toBe(413);
  });
  it("requires explicit payment acknowledgments and hides the new reference from seller transfer response", async () => {
    const b = await seedConfirmedBooking();
    await prisma.paymentSubmission.create({ data: { bookingId: b.bookingId, channel: "GCASH", reference: "original", amountCents: 40000 } });
    vi.mocked(getSession).mockResolvedValue({ id: b.customerId, email: "seller@test.test", role: "CUSTOMER" });
    const made = await create(request("", { bookingId: b.bookingId, priceCents: 25000, paymentChannel: "GCASH", paymentAccountName: "Seller", paymentAccountNumber: "09171234567" }));
    expect(made.status).toBe(201);
    const { id } = await made.json();
    const buyer = await seedCustomer();
    vi.mocked(getSession).mockResolvedValue({ id: buyer.id, email: buyer.email, role: "CUSTOMER" });
    const claimed = await action(request(`${id}/claim`, { customerName: "Buyer", customerMobile: "09181234567" }), params(`${id}/claim`));
    const { tradeId } = await claimed.json();
    const paid = `trades/${tradeId}/payment`;
    expect((await action(request(paid, {}), params(paid))).status).toBe(400);
    expect((await action(request(paid, { sent: true }), params(paid))).status).toBe(200);
    vi.mocked(getSession).mockResolvedValue({ id: b.customerId, email: "seller@test.test", role: "CUSTOMER" });
    const transfer = `trades/${tradeId}/transfer`;
    expect((await action(request(transfer, {}), params(transfer))).status).toBe(400);
    const sold = await action(request(transfer, { received: true }), params(transfer));
    expect(sold.status).toBe(200);
    expect(await sold.json()).toEqual({ ok: true });
    const thread = await read(new NextRequest(`http://localhost/api/pasalo/trades/${tradeId}`), params(`trades/${tradeId}`));
    expect(thread.headers.get("cache-control")).toContain("private");
    expect((await thread.json()).bookingReference).toBeNull();
  });
});
