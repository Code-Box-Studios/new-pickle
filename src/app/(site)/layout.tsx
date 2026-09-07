import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { BottomTabBar } from "@/components/nav/BottomTabBar";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader session={session} />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <footer className="border-t border-black/5 bg-slate-50 py-8 text-sm text-muted">
        <div className="mx-auto max-w-6xl space-y-2 px-4">
          <p className="font-semibold text-ink-soft">
            Rally<span className="text-accent-dark">Point</span>
          </p>
          <p>
            Payment goes directly to the venue. The venue confirms your
            reservation. RallyPoint makes discovery and booking easier.
          </p>
          <p className="flex gap-4">
            <Link href="/search" className="hover:text-ink">
              Explore courts
            </Link>
            <Link href="/bookings" className="hover:text-ink">
              My bookings
            </Link>
          </p>
        </div>
      </footer>
      <BottomTabBar />
    </div>
  );
}
