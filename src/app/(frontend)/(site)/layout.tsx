import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { NavigationLink as Link } from "@/components/nav/NavigationLink";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Brand } from "@/components/ui/brand";
import { ArrowUpRight, Code2 } from "lucide-react";
import { CourtPattern, PickleballIcon } from "@/components/ui/pickleball";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { getSiteContent } from "@/cms/content";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, content] = await Promise.all([
    getSession(),
    getSiteContent(),
  ]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader session={session} content={content} />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-24 outline-none md:pb-0"
      >
        {children}
      </main>
      <footer className="footer-region relative overflow-hidden bg-brand-950 pb-24 pt-16 text-sm text-white/65 md:pb-0">
        <CourtPattern className="pointer-events-none absolute -top-12 left-[35%] w-[640px] rotate-[-20deg] text-brand-200 opacity-[0.045]" />
        <div className="page-shell relative flex flex-col justify-between gap-10 sm:flex-row sm:gap-12">
          <div className="max-w-md">
            <Link
              href="/#top"
              className="brand-link inline-block rounded-xl"
              aria-label="RallyPoint home"
            >
              <Brand inverse />
            </Link>
            <p className="mt-6 text-2xl font-medium leading-snug tracking-tight text-white sm:text-[28px]">{content.footerTagline}</p>
            <p className="mt-4 max-w-sm leading-relaxed">{content.footerDescription}</p>
            <InstallAppButton />
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex w-full flex-col gap-3 sm:max-w-xs sm:pt-2"
          >
            {content.footerLinks.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn(
                  "h-auto border border-white/15 bg-white/[0.025] px-5 py-3.5",
                  "motion-trigger flex min-h-12 w-full items-center justify-between gap-5 rounded-full text-white transition-colors hover:border-brand-300/40 hover:bg-white/5 focus-visible:outline-white",
                )}
              >
                <Link href={item.href}>
                  <span className="flex min-w-0 items-center gap-3"><PickleballIcon className="size-4 shrink-0 text-brand-300" /><span className="truncate">{item.label}</span></span>
                  <ArrowUpRight className="motion-arrow size-4 shrink-0 text-brand-200" data-direction="up-right" aria-hidden />
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="page-shell relative mt-12">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs sm:flex-row">
            <p className="text-white/50">© {new Date().getFullYear()} RallyPoint</p>
            <p className="flex items-center gap-2 text-white/60">
              <Code2
                className="size-4 text-brand-300"
                strokeWidth={1.7}
                aria-hidden
              />
              Powered by{" "}
              <span className="font-medium text-white">
                {content.studioName}
              </span>
            </p>
          </div>
        </div>
      </footer>
      <BottomTabBar />
    </div>
  );
}
