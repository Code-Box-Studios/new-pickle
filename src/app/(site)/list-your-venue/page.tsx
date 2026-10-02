import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LineChart, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreateVenueButton } from "@/components/venue-admin/CreateVenueButton";

export const metadata: Metadata = {
  title: "List your venue",
  description:
    "Fill your courts with more players. List your pickleball venue on RallyPoint.",
};

export default async function ListYourVenuePage() {
  const session = await getSession();
  return (
    <>
      <section className="hero-band text-white">
        <div className="page-shell py-16 text-center lg:py-24">
          <div className="motion-enter mx-auto max-w-4xl">
            <Badge
              variant="outline"
              className="border-white/20 bg-white/5 px-4 py-2 text-white/75"
            >
              For venue owners
            </Badge>
            <h1 className="hero-title mt-6">
              Fill your courts with more players.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
              List your venue on RallyPoint, take online reservations, and get
              paid directly — you stay in control of your courts.
            </p>
            <div className="mt-8 flex justify-center">
              {session ? (
                <CreateVenueButton label="Create your venue" />
              ) : (
                <Button asChild size="lg">
                  <Link href="/login?next=/list-your-venue">Get started</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="page-shell reveal-section py-16 lg:py-24">
        <div className="stagger-enter grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: CalendarCheck,
              title: "Take reservations",
              body: "Players discover and book your courts around the clock.",
            },
            {
              icon: ShieldCheck,
              title: "Get paid directly",
              body: "Payments go straight to your GCash or Maya — no middleman.",
            },
            {
              icon: LineChart,
              title: "Stay in control",
              body: "You confirm every booking and set your own hours and pricing.",
            },
          ].map((feature) => (
            <Card key={feature.title} className="feature-card p-6 sm:p-8">
              <div className="grid size-12 place-items-center rounded-lg bg-secondary text-brand-700">
                <feature.icon className="size-6" aria-hidden />
              </div>
              <h2 className="mt-6 text-[22px] font-medium leading-snug text-ink">
                {feature.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
