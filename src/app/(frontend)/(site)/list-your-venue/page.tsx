import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  LineChart,
  ShieldCheck,
  MapPin,
  Trophy,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getVenueLandingContent } from "@/cms/content";
const benefitIcons = {
  calendar: CalendarCheck,
  shield: ShieldCheck,
  chart: LineChart,
  map: MapPin,
  trophy: Trophy,
};

import { CreateVenueButton } from "@/components/venue-admin/CreateVenueButton";

export const metadata: Metadata = {
  title: "List your venue",
  description:
    "Fill your courts with more players. List your pickleball venue on Pikol.",
};

export default async function ListYourVenuePage() {
  const [session, content] = await Promise.all([
    getSession(),
    getVenueLandingContent(),
  ]);
  return (
    <>
      <section className="hero-band text-white">
        <div className="page-shell py-16 text-center lg:py-24">
          <div className="motion-enter mx-auto max-w-4xl">
            <Badge
              variant="outline"
              className="border-white/20 bg-white/5 px-4 py-2 text-white/75"
            >
              {content.eyebrow}
            </Badge>
            <h1 className="hero-title mt-6">{content.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
              {content.description}
            </p>
            <div className="mt-8 flex justify-center">
              {session ? (
                <CreateVenueButton label={content.createLabel} />
              ) : (
                <Button asChild size="lg">
                  <Link href="/login?next=/list-your-venue">
                    {content.signInLabel}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="page-shell reveal-section py-16 lg:py-24">
        <div className="stagger-enter grid gap-6 sm:grid-cols-3">
          {content.benefits.map((feature) => {
            const Icon = benefitIcons[feature.icon] ?? CalendarCheck;
            return (
              <Card key={feature.title} className="feature-card p-6 sm:p-8">
                <div className="grid size-12 place-items-center rounded-lg bg-secondary text-brand-700">
                  <Icon className="size-6" aria-hidden />
                </div>
                <h2 className="mt-6 text-[22px] font-medium leading-snug text-ink">
                  {feature.title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
