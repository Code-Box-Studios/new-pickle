import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";
import { CourtPattern } from "@/components/ui/pickleball";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(safeNextPath(sp.next) ?? "/bookings");

  return (
    <div className="hero-band relative overflow-hidden pt-[88px] lg:pt-24">
      <CourtPattern className="pointer-events-none absolute -right-40 top-12 w-[780px] rotate-[-25deg] text-brand-300 opacity-[0.08]" />
      <div className="relative grid min-h-[75dvh] place-items-center px-4 py-14 sm:py-20">
        <Card className="w-full max-w-md p-6 shadow-elevated sm:p-9">
          <LoginForm nextPath={safeNextPath(sp.next)} />
        </Card>
      </div>
    </div>
  );
}
