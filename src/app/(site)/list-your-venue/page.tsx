import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LineChart, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateVenueButton } from "@/components/venue-admin/CreateVenueButton";

export const metadata: Metadata = {
  title: "List your venue",
  description: "Fill your courts with more players. List your pickleball venue on RallyPoint.",
};

export default async function ListYourVenuePage() {
  const session = await getSession();

  return (
    <div className="page-shell py-12 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="eyebrow inline-flex items-center rounded-full border border-brand-200/70 bg-mist px-4 py-2">
          For venue owners
        </span>
        <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-ink sm:text-5xl lg:text-6xl">
          Fill your courts with more players.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
          List your venue on RallyPoint, take online reservations, and get paid
          directly — you stay in control of your courts.
        </p>
        <div className="mt-8 flex justify-center">
          {session ? (
            <CreateVenueButton label="Create your venue" />
          ) : (
            <Link href="/login?next=/list-your-venue" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-6">
        {[
          { icon: CalendarCheck, title: "Take reservations", body: "Players discover and book your courts around the clock." },
          { icon: ShieldCheck, title: "Get paid directly", body: "Payments go straight to your GCash or Maya — no middleman." },
          { icon: LineChart, title: "Stay in control", body: "You confirm every booking and set your own hours and pricing." },
        ].map((f) => (
          <Card key={f.title} className="p-6 sm:p-7">
            <div className="grid size-12 place-items-center rounded-2xl bg-mist text-brand-700">
              <f.icon className="size-6" aria-hidden />
            </div>
            <h2 className="mt-6 text-lg font-semibold tracking-tight text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
