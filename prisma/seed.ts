import { PrismaClient, type PaymentChannel } from "../src/generated/prisma";

const prisma = new PrismaClient();

// Mon–Thu 8a–10p, Fri 8a–11p, Sat 7a–11p, Sun 7a–10p (minutes from midnight).
const WEEK = [
  { d: 0, o: 7 * 60, c: 22 * 60 },
  { d: 1, o: 8 * 60, c: 22 * 60 },
  { d: 2, o: 8 * 60, c: 22 * 60 },
  { d: 3, o: 8 * 60, c: 22 * 60 },
  { d: 4, o: 8 * 60, c: 22 * 60 },
  { d: 5, o: 8 * 60, c: 23 * 60 },
  { d: 6, o: 7 * 60, c: 23 * 60 },
];

type CourtSeed = {
  name: string;
  indoor: boolean;
  covered: boolean;
  surface: string;
  priceCents: number;
};

type VenueSeed = {
  slug: string;
  name: string;
  barangay: string;
  description: string;
  amenities: string[];
  houseRules: string;
  contactNumber: string;
  reviews: { rating: number; body: string }[];
  courts: CourtSeed[];
};

const VENUES: VenueSeed[] = [
  {
    slug: "rally-court-davao",
    name: "Rally Court Davao",
    barangay: "Buhangin",
    description:
      "Davao's flagship indoor pickleball hub — six pro-cushioned courts, night lights, and a chilled lounge for between-game hangs.",
    amenities: ["indoor", "covered", "lights", "parking", "restroom", "shower", "paddle_rental", "lounge", "water", "aircon"],
    houseRules: "Non-marking shoes required. 15-minute grace period. Bring your own paddles or rent at the desk.",
    contactNumber: "0917 555 0101",
    reviews: [
      { rating: 5, body: "Best courts in the city. Booking here is effortless." },
      { rating: 5, body: "Great lighting and the surface is top-notch." },
      { rating: 4, body: "Can get busy on weekends but worth it." },
    ],
    courts: [
      { name: "Court 1", indoor: true, covered: true, surface: "Cushioned acrylic", priceCents: 45000 },
      { name: "Court 2", indoor: true, covered: true, surface: "Cushioned acrylic", priceCents: 45000 },
      { name: "Court 3", indoor: true, covered: true, surface: "Cushioned acrylic", priceCents: 40000 },
    ],
  },
  {
    slug: "ace-pickle-matina",
    name: "Ace Pickle Matina",
    barangay: "Matina",
    description:
      "Friendly neighborhood club with both covered and open-air courts. Perfect for casual rallies after work.",
    amenities: ["indoor", "outdoor", "covered", "lights", "parking", "restroom", "water", "ball_rental"],
    houseRules: "Please clear the court on time. Water only on court — no food.",
    contactNumber: "0917 555 0202",
    reviews: [
      { rating: 5, body: "Love the open-air courts in the evening." },
      { rating: 4, body: "Solid value for money." },
    ],
    courts: [
      { name: "Indoor A", indoor: true, covered: true, surface: "Acrylic", priceCents: 40000 },
      { name: "Indoor B", indoor: true, covered: true, surface: "Acrylic", priceCents: 40000 },
      { name: "Open Court", indoor: false, covered: false, surface: "Concrete", priceCents: 35000 },
    ],
  },
  {
    slug: "lanang-smash-center",
    name: "Lanang Smash Center",
    barangay: "Lanang",
    description:
      "Compact, competitive, and always in great shape. A favorite for leagues and serious players.",
    amenities: ["indoor", "covered", "lights", "parking", "restroom", "shower", "aircon"],
    houseRules: "Court shoes required. Booked slots start on the hour.",
    contactNumber: "0917 555 0303",
    reviews: [
      { rating: 5, body: "Air-conditioned and spotless." },
      { rating: 5, body: "Great for league nights." },
    ],
    courts: [
      { name: "Center Court", indoor: true, covered: true, surface: "Cushioned acrylic", priceCents: 45000 },
      { name: "Court 2", indoor: true, covered: true, surface: "Acrylic", priceCents: 40000 },
    ],
  },
  {
    slug: "toril-rally-grounds",
    name: "Toril Rally Grounds",
    barangay: "Toril",
    description:
      "Breezy outdoor courts on the south side. Big parking, easy vibes, sunrise sessions welcome.",
    amenities: ["outdoor", "lights", "parking", "restroom", "water", "paddle_rental"],
    houseRules: "Play may pause for weather. Keep the grounds clean.",
    contactNumber: "0917 555 0404",
    reviews: [
      { rating: 4, body: "Nice morning games, lots of space." },
      { rating: 5, body: "Underrated spot in Toril." },
    ],
    courts: [
      { name: "North Court", indoor: false, covered: false, surface: "Concrete", priceCents: 35000 },
      { name: "South Court", indoor: false, covered: false, surface: "Concrete", priceCents: 35000 },
    ],
  },
  {
    slug: "agdao-dink-club",
    name: "Agdao Dink Club",
    barangay: "Agdao",
    description:
      "Central, easy to reach, and beginner-friendly. Coaches on site most evenings.",
    amenities: ["indoor", "covered", "lights", "restroom", "paddle_rental", "ball_rental", "water"],
    houseRules: "Beginners welcome. Please rotate courts during peak hours.",
    contactNumber: "0917 555 0505",
    reviews: [
      { rating: 4, body: "Great for learning the game." },
      { rating: 5, body: "Friendly crowd and helpful staff." },
    ],
    courts: [
      { name: "Court A", indoor: true, covered: true, surface: "Acrylic", priceCents: 38000 },
      { name: "Court B", indoor: true, covered: true, surface: "Acrylic", priceCents: 38000 },
    ],
  },
];

const PAYMENT_METHODS: { channel: PaymentChannel; accountName: string; accountNumber: string; instructions?: string }[] = [
  { channel: "GCASH", accountName: "Pikol Venue", accountNumber: "0917 555 1234", instructions: "Send the exact amount and keep your receipt." },
  { channel: "MAYA", accountName: "Pikol Venue", accountNumber: "0918 555 5678" },
];

async function main() {
  console.log("Seeding Pikol…");

  const admin = await prisma.user.upsert({
    where: { email: "admin@rallypoint.test" },
    update: { role: "ADMIN", name: "Platform Admin" },
    create: { email: "admin@rallypoint.test", role: "ADMIN", name: "Platform Admin" },
  });
  const owner = await prisma.user.upsert({
    where: { email: "owner@rallypoint.test" },
    update: { role: "OWNER", name: "Venue Owner" },
    create: { email: "owner@rallypoint.test", role: "OWNER", name: "Venue Owner" },
  });
  const customer = await prisma.user.upsert({
    where: { email: "player@rallypoint.test" },
    update: { role: "CUSTOMER", name: "Juan Dela Cruz", mobile: "0917 000 1111" },
    create: { email: "player@rallypoint.test", role: "CUSTOMER", name: "Juan Dela Cruz", mobile: "0917 000 1111" },
  });

  for (const v of VENUES) {
    const ratingAvg = v.reviews.reduce((s, r) => s + r.rating, 0) / v.reviews.length;
    const photos = [1, 2, 3].map((i) => `https://picsum.photos/seed/${v.slug}-${i}/1200/800`);

    const venue = await prisma.venue.upsert({
      where: { slug: v.slug },
      update: {
        name: v.name,
        description: v.description,
        barangay: v.barangay,
        amenities: v.amenities,
        houseRules: v.houseRules,
        contactNumber: v.contactNumber,
        photos,
        ratingAvg: Math.round(ratingAvg * 10) / 10,
        ratingCount: v.reviews.length,
        status: "APPROVED",
        isPublished: true,
        ownerId: owner.id,
      },
      create: {
        slug: v.slug,
        name: v.name,
        description: v.description,
        city: "Davao City",
        barangay: v.barangay,
        amenities: v.amenities,
        houseRules: v.houseRules,
        contactNumber: v.contactNumber,
        photos,
        ratingAvg: Math.round(ratingAvg * 10) / 10,
        ratingCount: v.reviews.length,
        status: "APPROVED",
        isPublished: true,
        ownerId: owner.id,
      },
    });

    await prisma.venueVerification.upsert({
      where: { venueId: venue.id },
      update: { status: "APPROVED" },
      create: { venueId: venue.id, status: "APPROVED" },
    });

    if ((await prisma.court.count({ where: { venueId: venue.id } })) === 0) {
      for (const [i, c] of v.courts.entries()) {
        await prisma.court.create({
          data: {
            venueId: venue.id,
            name: c.name,
            indoor: c.indoor,
            covered: c.covered,
            surface: c.surface,
            priceCents: c.priceCents,
            sortOrder: i,
            schedules: { create: WEEK.map((w) => ({ dayOfWeek: w.d, openMinute: w.o, closeMinute: w.c })) },
          },
        });
      }
    }

    if ((await prisma.paymentMethod.count({ where: { venueId: venue.id } })) === 0) {
      for (const [i, pm] of PAYMENT_METHODS.entries()) {
        await prisma.paymentMethod.create({
          data: {
            venueId: venue.id,
            channel: pm.channel,
            accountName: pm.accountName,
            accountNumber: pm.accountNumber,
            instructions: pm.instructions ?? null,
            sortOrder: i,
          },
        });
      }
    }

    if ((await prisma.review.count({ where: { venueId: venue.id } })) === 0) {
      for (const r of v.reviews) {
        await prisma.review.create({
          data: { venueId: venue.id, userId: customer.id, rating: r.rating, body: r.body },
        });
      }
    }
  }

  console.log("\nSeed complete. Sign in with these emails (dev magic-link banner):");
  console.log(`  admin    → ${admin.email}`);
  console.log(`  owner    → ${owner.email}  (owns all ${VENUES.length} venues)`);
  console.log(`  customer → ${customer.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
