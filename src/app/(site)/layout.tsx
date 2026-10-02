import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Brand } from "@/components/ui/brand";
import { ArrowUpRight, Code2 } from "lucide-react";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader session={session} />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-24 outline-none md:pb-0"
      >
        {children}
      </main>
      <footer className="bg-brand-950 pb-24 pt-16 text-sm text-white/65 md:pb-0">
        <div className="page-shell flex flex-col justify-between gap-8 sm:flex-row sm:gap-12">
          <div className="max-w-md">
            <Link
              href="/"
              className="inline-block rounded-xl"
              aria-label="RallyPoint home"
            >
              <Brand inverse />
            </Link>
            <p className="mt-5 leading-relaxed">
              Payment goes directly to the venue. The venue confirms your
              reservation. RallyPoint makes discovery and booking easier.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-col items-start gap-1 sm:items-end"
          >
            {[
              { href: "/search", label: "Explore courts" },
              { href: "/bookings", label: "My bookings" },
              { href: "/list-your-venue", label: "List your venue" },
            ].map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn(
                  "h-auto p-0",
                  "flex min-h-11 items-center gap-2 rounded-lg text-white transition-colors hover:text-primary focus-visible:outline-white",
                )}
              >
                <Link href={item.href}>
                  {item.label}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="page-shell mt-12">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs sm:flex-row">
            <p className="text-white/50">
              A little less planning. A lot more playing.
            </p>
            <p className="flex items-center gap-2 text-white/60">
              <Code2
                className="size-4 text-brand-300"
                strokeWidth={1.7}
                aria-hidden
              />
              Powered by{" "}
              <span className="font-medium text-white">Code Box Studios</span>
            </p>
          </div>
        </div>
      </footer>
      <BottomTabBar />
    </div>
  );
}
