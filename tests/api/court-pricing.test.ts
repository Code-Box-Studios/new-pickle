import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, resetDb } from "../db";
import {
  seedCustomer,
  seedOwnerVenueCourt,
  seedSentryVenue,
  slot,
} from "../factories";
import { POST as createCourt } from "@/app/api/owner/venues/[id]/courts/route";
import { PATCH as updateCourt } from "@/app/api/owner/venues/[id]/courts/[courtId]/route";
import { POST as createWalkIn } from "@/app/api/owner/venues/[id]/walkins/route";
import { POST as reserveCourt } from "@/app/api/bookings/route";
import {
  courtSlotsForDate,
  searchAvailability,
} from "@/lib/availability/engine";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

const rates = [
  { period: "midnight", startMinute: 0, endMinute: 360, priceCents: 20000 },
  { period: "morning", startMinute: 360, endMinute: 720, priceCents: 30000 },
  { period: "afternoon", startMinute: 720, endMinute: 1020, priceCents: 50000 },
  { period: "evening", startMinute: 1020, endMinute: 1440, priceCents: 70000 },
];

function request(body: unknown, method = "POST") {
  return new NextRequest("http://localhost:3000/api/courts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDb();
  vi.mocked(getSession).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

async function ownerCourt() {
  const base = await seedOwnerVenueCourt();
  vi.mocked(getSession).mockResolvedValue({
    id: base.ownerId,
    email: null,
    role: "OWNER",
  });
  return base;
}

async function configureRates(
  venueId: string,
  courtId: string,
  timeRates: unknown = rates,
) {
  return updateCourt(request({ timeRates }, "PATCH"), {
    params: Promise.resolve({ id: venueId, courtId }),
  });
}

describe("court time rates", () => {
  it("stores owner rates and quotes a session crossing afternoon into evening", async () => {
    const { venueId, courtId } = await ownerCourt();
    expect((await configureRates(venueId, courtId)).status).toBe(200);
    const day = slot(3, 16).startsAt;
    await prisma.courtSchedule.create({
      data: {
        courtId,
        dayOfWeek: day.getUTCDay(),
        openMinute: 0,
        closeMinute: 1440,
      },
    });
    const slots = await courtSlotsForDate(courtId, day, {
      durationMinutes: 180,
    });
    const quote = slots.find((s) => s.startsAt.getUTCHours() === 16);
    // One afternoon hour at ₱500 plus two evening hours at ₱700.
    expect(quote?.priceCents).toBe(190000);
    expect(
      (await searchAvailability({ city: "Davao City", date: day }))[0]
        .priceFromCents,
    ).toBe(20000);
  });

  it("persists the combined rate when the player reserves a long session", async () => {
    const { venueId, courtId } = await ownerCourt();
    expect((await configureRates(venueId, courtId)).status).toBe(200);
    const { startsAt } = slot(3, 11);
    await prisma.courtSchedule.create({
      data: {
        courtId,
        dayOfWeek: startsAt.getUTCDay(),
        openMinute: 0,
        closeMinute: 1440,
      },
    });
    const customer = await seedCustomer();
    vi.mocked(getSession).mockResolvedValue({
      id: customer.id,
      email: customer.email,
      role: "CUSTOMER",
    });
    const res = await reserveCourt(
      request({
        courtId,
        startsAt: startsAt.toISOString(),
        durationMinutes: 420,
        priceCents: 1,
      }),
    );
    expect(res.status).toBe(200);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: (await res.json()).id },
    });
    // Morning 11–12: ₱300; afternoon 12–17: ₱2,500; evening 17–18: ₱700.
    expect(booking.priceCents).toBe(350000);
  });

  it("prices walk-ins across midnight using both days' rate bands", async () => {
    const { venueId, courtId } = await ownerCourt();
    expect((await configureRates(venueId, courtId)).status).toBe(200);
    const { startsAt } = slot(3, 23);
    const res = await createWalkIn(
      request({
        courtId,
        startsAt: startsAt.toISOString(),
        durationMinutes: 120,
        name: "Player",
      }),
      { params: Promise.resolve({ id: venueId }) },
    );
    expect(res.status).toBe(200);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: (await res.json()).id },
    });
    expect(booking.priceCents).toBe(90000);
  });

  it("keeps flat-rate quotes when no time bands are configured", async () => {
    const { courtId } = await ownerCourt();
    const day = slot(3, 8).startsAt;
    await prisma.courtSchedule.create({
      data: {
        courtId,
        dayOfWeek: day.getUTCDay(),
        openMinute: 480,
        closeMinute: 1440,
      },
    });
    const quotes = await courtSlotsForDate(courtId, day, {
      durationMinutes: 240,
    });
    expect(quotes[0].priceCents).toBe(160000);
  });

  it("creates a court with its time rates", async () => {
    const { venueId } = await ownerCourt();
    const res = await createCourt(
      request({ name: "New court", priceCents: 40000, timeRates: rates }),
      { params: Promise.resolve({ id: venueId }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).court.timeRates).toEqual(rates);
  });

  it.each([
    [{ ...rates[0], startMinute: -1 }],
    [{ ...rates[0], endMinute: 1441 }],
    [{ ...rates[0], startMinute: 0.5 }],
    [{ ...rates[0], endMinute: 0 }],
    [{ ...rates[0], priceCents: -1 }],
    [{ ...rates[0], priceCents: 100.5 }],
    [{ ...rates[0], period: "unknown" }],
    [rates[0], { ...rates[1], startMinute: 300 }],
    [rates[0], { ...rates[0], startMinute: 400, endMinute: 500 }],
  ])(
    "rejects invalid bands without changing the stored price: %j",
    async (...invalid) => {
      const { venueId, courtId } = await ownerCourt();
      const res = await configureRates(venueId, courtId, invalid);
      expect(res.status).toBe(400);
      expect(
        (await prisma.court.findUniqueOrThrow({ where: { id: courtId } }))
          .priceCents,
      ).toBe(40000);
    },
  );

  it.each([100.5, -1, null, "100", 2147483648])(
    "rejects non-integer or out-of-range flat prices: %j",
    async (priceCents) => {
      const { venueId, courtId } = await ownerCourt();
      const res = await updateCourt(request({ priceCents }, "PATCH"), {
        params: Promise.resolve({ id: venueId, courtId }),
      });
      expect(res.status).toBe(400);
    },
  );

  it("denies another owner access before rates are changed", async () => {
    const A = await ownerCourt();
    const B = await seedOwnerVenueCourt();
    vi.mocked(getSession).mockResolvedValue({
      id: B.ownerId,
      email: null,
      role: "OWNER",
    });
    expect((await configureRates(A.venueId, A.courtId)).status).toBe(403);
  });

  it("rejects local price edits for a connected Sentry court", async () => {
    const { ownerId, venueId, courtId } = await seedSentryVenue();
    vi.mocked(getSession).mockResolvedValue({
      id: ownerId,
      email: null,
      role: "OWNER",
    });
    expect((await configureRates(venueId, courtId)).status).toBe(409);
    expect(
      (
        await updateCourt(request({ priceCents: 50000 }, "PATCH"), {
          params: Promise.resolve({ id: venueId, courtId }),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await createCourt(
          request({ name: "New local court", priceCents: 50000 }),
          { params: Promise.resolve({ id: venueId }) },
        )
      ).status,
    ).toBe(409);
  });

  it("does not create a local walk-in for a Sentry venue", async () => {
    const { ownerId, venueId, courtId } = await seedSentryVenue();
    vi.mocked(getSession).mockResolvedValue({
      id: ownerId,
      email: null,
      role: "OWNER",
    });
    const { startsAt } = slot();
    const res = await createWalkIn(
      request({ courtId, startsAt: startsAt.toISOString(), name: "Player" }),
      { params: Promise.resolve({ id: venueId }) },
    );
    expect(res.status).toBe(409);
    expect(await prisma.booking.count({ where: { courtId } })).toBe(0);
  });

  it("ignores saved local bands when a court later connects to Sentry", async () => {
    const { venueId, courtId } = await ownerCourt();
    expect((await configureRates(venueId, courtId)).status).toBe(200);
    await prisma.court.update({
      where: { id: courtId },
      data: { externalRef: "sentry-court" },
    });
    await prisma.sentryConnection.create({
      data: {
        venueId,
        connectionState: "CONNECTED",
        sentryBusinessRef: "sentry-business",
      },
    });
    const day = slot(3, 16).startsAt;
    await prisma.courtSchedule.create({
      data: {
        courtId,
        dayOfWeek: day.getUTCDay(),
        openMinute: 0,
        closeMinute: 1440,
      },
    });
    vi.stubEnv("SENTRY_MODE", "mock");
    const quotes = await courtSlotsForDate(courtId, day, {
      durationMinutes: 180,
    });
    expect(
      quotes.find((quote) => quote.startsAt.getUTCHours() === 16)?.priceCents,
    ).toBe(120000);
    expect(
      (await searchAvailability({ city: "Davao City", date: day }))[0]
        .priceFromCents,
    ).toBe(40000);
  });
});
