import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Brand } from "@/components/ui/brand";
import { ArrowUpRight } from "lucide-react";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <SiteHeader session={session} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none md:pb-0">{children}</main>
      <footer className="bg-brand-950 pb-28 pt-12 text-sm text-brand-200 md:pb-12">
        <div className="page-shell flex flex-col justify-between gap-8 sm:flex-row sm:gap-12">
          <div className="max-w-md">
            <Link href="/" className="inline-block rounded-xl" aria-label="RallyPoint home"><Brand inverse /></Link>
            <p className="mt-5 leading-relaxed">
              Payment goes directly to the venue. The venue confirms your
              reservation. RallyPoint makes discovery and booking easier.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-col items-start gap-1 sm:items-end">
            {[
              { href: "/search", label: "Explore courts" },
              { href: "/bookings", label: "My bookings" },
              { href: "/list-your-venue", label: "List your venue" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-2 rounded-lg text-white transition-colors hover:text-accent focus-visible:outline-white">
                {item.label}<ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      <BottomTabBar />
    </div>
  );
}
