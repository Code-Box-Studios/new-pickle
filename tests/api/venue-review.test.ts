import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { submitVenueForReview, reviewVenue } from "@/lib/venue/review";
import { publishVenue, unpublishVenue } from "@/lib/venue/publish";
import { searchAvailability } from "@/lib/availability/engine";
import { ConflictError, ValidationError } from "@/lib/booking/errors";

beforeEach(resetDb);

function futureMonday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function admin() {
  return prisma.user.create({ data: { email: `a-${randomUUID().slice(0, 8)}@t.test`, role: "ADMIN" } });
}

async function completeDraftVenue() {
  const owner = await prisma.user.create({ data: { email: `o-${randomUUID().slice(0, 8)}@t.test`, role: "OWNER" } });
  const venue = await prisma.venue.create({
    data: {
      slug: `v-${randomUUID().slice(0, 8)}`,
      name: "V",
      city: "Davao City",
      status: "DRAFT",
      isPublished: false,
      ownerId: owner.id,
      photos: ["/api/media/venue-media/x.png"],
    },
  });
  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: "Court 1",
      priceCents: 40000,
      active: true,
      schedules: { create: [{ dayOfWeek: 1, openMinute: 480, closeMinute: 1320 }] },
    },
  });
  await prisma.paymentMethod.create({
    data: { venueId: venue.id, channel: "GCASH", accountName: "V", accountNumber: "09", active: true },
  });
  return { owner, venue, court };
}

async function inSearch(slug: string): Promise<boolean> {
  const results = await searchAvailability({ city: "Davao City", date: futureMonday(), durationMinutes: 60 });
  return results.some((r) => r.venue.slug === slug);
}

describe("venue submit / review / publish", () => {
  it("refuses to submit an incomplete venue and stays DRAFT", async () => {
    const owner = await prisma.user.create({ data: { email: `o-${randomUUID().slice(0, 8)}@t.test`, role: "OWNER" } });
    const venue = await prisma.venue.create({
      data: { slug: `v-${randomUUID().slice(0, 8)}`, name: "V", city: "Davao City", status: "DRAFT", ownerId: owner.id, photos: [] },
    });
    await expect(submitVenueForReview(venue.id, "please review")).rejects.toBeInstanceOf(ValidationError);
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).status).toBe("DRAFT");
  });

  it("requires a submission note", async () => {
    const { venue } = await completeDraftVenue();
    await expect(submitVenueForReview(venue.id, "   ")).rejects.toBeInstanceOf(ValidationError);
  });

  it("submits a complete venue and records the note", async () => {
    const { venue } = await completeDraftVenue();
    await submitVenueForReview(venue.id, "Family-run court in Buhangin");
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).status).toBe("PENDING_REVIEW");
    const ver = await prisma.venueVerification.findUniqueOrThrow({ where: { venueId: venue.id } });
    expect(ver.status).toBe("PENDING_REVIEW");
    expect(ver.submittedNote).toBe("Family-run court in Buhangin");
  });

  it("full lifecycle: submit → reject → resubmit → approve → publish → appears in search", async () => {
    const a = await admin();
    const { venue } = await completeDraftVenue();
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "REJECTED", a.id, "Add clearer photos", new Date());
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).status).toBe("REJECTED");
    await submitVenueForReview(venue.id, "updated"); // resubmit from REJECTED
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    expect(await inSearch(venue.slug)).toBe(false); // approved but not published
    await publishVenue(venue.id);
    expect(await inSearch(venue.slug)).toBe(true);
  });

  it("publish is refused unless APPROVED", async () => {
    const { venue } = await completeDraftVenue();
    await expect(publishVenue(venue.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("publish is refused if approved but no longer complete", async () => {
    const a = await admin();
    const { venue, court } = await completeDraftVenue();
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    await prisma.court.update({ where: { id: court.id }, data: { active: false } });
    await expect(publishVenue(venue.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("suspend forces offline; reinstate returns APPROVED but stays unpublished", async () => {
    const a = await admin();
    const { venue } = await completeDraftVenue();
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    await publishVenue(venue.id);
    expect(await inSearch(venue.slug)).toBe(true);

    await reviewVenue(venue.id, "SUSPENDED", a.id, "Policy issue", new Date());
    let v = await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(v.status).toBe("SUSPENDED");
    expect(v.isPublished).toBe(false);
    expect(await inSearch(venue.slug)).toBe(false);

    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date()); // reinstate
    v = await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } });
    expect(v.status).toBe("APPROVED");
    expect(v.isPublished).toBe(false); // not auto-relisted
    expect(await inSearch(venue.slug)).toBe(false);
  });

  it("unpublish removes a live venue from search", async () => {
    const a = await admin();
    const { venue } = await completeDraftVenue();
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    await publishVenue(venue.id);
    await unpublishVenue(venue.id);
    expect(await inSearch(venue.slug)).toBe(false);
  });

  it("a Google Maps link and a null barangay never block publish (gating unchanged)", async () => {
    const a = await admin();
    const { venue } = await completeDraftVenue();
    // set a maps link and clear barangay — neither is part of the completeness gate
    await prisma.venue.update({
      where: { id: venue.id },
      data: { mapUrl: "https://maps.app.goo.gl/abc123", barangay: null },
    });
    await submitVenueForReview(venue.id, "note");
    await reviewVenue(venue.id, "APPROVED", a.id, null, new Date());
    await expect(publishVenue(venue.id)).resolves.toBeUndefined(); // publishes fine
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: venue.id } })).isPublished).toBe(true);
  });
});
