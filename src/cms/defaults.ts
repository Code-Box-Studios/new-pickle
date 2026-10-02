export const siteDefaults = {
  headerTagline: "Pickleball, made simple.",
  homeLabel: "Home",
  exploreLabel: "Explore",
  bookingsLabel: "My bookings",
  venueLabel: "For venues",
  searchLabel: "Find courts",
  signInLabel: "Sign in",
  footerDescription:
    "Payment goes directly to the venue. The venue confirms your reservation. RallyPoint makes discovery and booking easier.",
  footerTagline: "A little less planning. A lot more playing.",
  studioName: "Code Box Studios",
  footerLinks: [
    { label: "Explore courts", href: "/search" },
    { label: "My bookings", href: "/bookings" },
    { label: "List your venue", href: "/list-your-venue" },
  ],
};
export const homeDefaults = {
  heroEyebrow: "Pickleball courts for everyone",
  heroTitle: "Find your",
  heroAccent: "next game.",
  heroDescription:
    "Search real-time court availability across independent venues. Reserve in seconds, pay the venue, and play.",
  primaryLabel: "Find a court",
  primaryHref: "#find-courts",
  secondaryLabel: "List your venue",
  secondaryHref: "/list-your-venue",
  availabilityLabel: "Live availability",
  paymentLabel: "Pay the venue directly",
  popularEyebrow: "Find your court",
  popularTitle: "Popular venues",
  popularDescription: "Highly rated courts near you.",
  exploreLabel: "Explore all courts",
  stepsEyebrow: "Less planning. More playing.",
  stepsTitle: "A good game is three steps away.",
  stepsDescription:
    "From finding your court to your first serve. Here's how RallyPoint works.",
  steps: [
    {
      title: "Discover",
      body: "Search courts by location, date, and time — see what's actually free.",
      icon: "map" as const,
    },
    {
      title: "Reserve & pay the venue",
      body: "Hold your slot, then pay the venue directly via GCash or Maya.",
      icon: "calendar" as const,
    },
    {
      title: "Play",
      body: "The venue confirms your booking. Show up and rally.",
      icon: "trophy" as const,
    },
  ],
  ownerEyebrow: "For venue owners",
  ownerTitle: "More players. Fuller courts.",
  ownerDescription:
    "List your venue, manage reservations, and receive payments directly.",
  ownerLabel: "List your venue",
  ownerHref: "/list-your-venue",
};
export const venueLandingDefaults = {
  eyebrow: "For venue owners",
  title: "Fill your courts with more players.",
  description:
    "List your venue on RallyPoint, take online reservations, and get paid directly — you stay in control of your courts.",
  createLabel: "Create your venue",
  signInLabel: "Get started",
  benefits: [
    {
      title: "Take reservations",
      body: "Players discover and book your courts around the clock.",
      icon: "calendar" as const,
    },
    {
      title: "Get paid directly",
      body: "Payments go straight to your GCash or Maya — no middleman.",
      icon: "shield" as const,
    },
    {
      title: "Stay in control",
      body: "You confirm every booking and set your own hours and pricing.",
      icon: "chart" as const,
    },
  ],
};
export type HomeContent = typeof homeDefaults;
export type SiteContent = typeof siteDefaults;
export type VenueLandingContent = typeof venueLandingDefaults;
