import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(sp.next ?? "/bookings");

  return (
    <div className="hero-band grid min-h-[75dvh] place-items-center px-4 py-14 sm:py-20">
      <Card className="w-full max-w-md p-6 shadow-elevated sm:p-9">
        <LoginForm nextPath={sp.next} />
      </Card>
    </div>
  );
}
