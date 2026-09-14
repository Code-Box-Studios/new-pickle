import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LineChart, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateVenueButton } from "@/components/venue-admin/CreateVenueButton";

export const metadata: Metadata = {
  title: "List your venue",
  description: "Fill your courts with more players. List your pickleball venue on RallyPoint.",
};

export default async function ListYourVenuePage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="text-center">
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
          For venue owners
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink">
          Fill your courts with more players.
        </h1>
        <p className="mt-3 text-lg text-muted">
          List your venue on RallyPoint, take online reservations, and get paid
          directly — you stay in control of your courts.
        </p>
        <div className="mt-8">
          {session ? (
            <CreateVenueButton label="Create your venue" />
          ) : (
            <Link href="/login?next=/list-your-venue">
              <Button size="lg">Get started</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          { icon: CalendarCheck, title: "Take reservations", body: "Players discover and book your courts around the clock." },
          { icon: ShieldCheck, title: "Get paid directly", body: "Payments go straight to your GCash or Maya — no middleman." },
          { icon: LineChart, title: "Stay in control", body: "You confirm every booking and set your own hours and pricing." },
        ].map((f) => (
          <Card key={f.title} className="p-5 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <f.icon className="size-6" aria-hidden />
            </div>
            <h2 className="mt-3 font-semibold text-ink">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
