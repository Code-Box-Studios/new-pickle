"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  Home,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Explore", icon: Search },
  { href: "/bookings", label: "My bookings", icon: CalendarCheck },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/95 shadow-[0_1px_12px_rgb(0_30_43/0.025)] backdrop-blur-xl">
      <div className="page-shell flex h-[72px] items-center gap-2 sm:gap-4 lg:h-[88px]">
        <Link
          href="/"
          className="group shrink-0 rounded-lg"
          aria-label="RallyPoint home"
        >
          <Brand className="text-lg sm:text-[22px] [&>span]:shadow-[0_4px_16px_-6px_rgb(0_237_100/0.5)]" />
          <span className="mt-0.5 hidden pl-[46px] text-[10px] font-medium tracking-wide text-muted-foreground xl:block">
            Pickleball, made simple.
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="ml-auto hidden items-center gap-1 rounded-full border border-border/70 bg-muted/75 p-1 lg:flex"
        >
          {NAV.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "h-10 gap-2 px-4 text-[13px] font-medium",
                active(item.href)
                  ? "bg-white text-brand-700 shadow-[0_1px_4px_rgb(0_30_43/0.08)] ring-1 ring-border/60"
                  : "text-ink-soft",
              )}
            >
              <Link
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
              >
                <item.icon className="size-3.5" strokeWidth={1.8} aria-hidden />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-4">
          <Button
            asChild
            variant="ghost"
            className="hidden gap-1.5 px-3 text-[13px] font-medium text-muted-foreground xl:inline-flex"
          >
            <Link href="/list-your-venue">
              <Building2 className="size-4" aria-hidden />
              For venues
            </Link>
          </Button>
          {session ? (
            <>
              <NotificationBell />
              <span className="sr-only" title={session.email}>
                {session.email}
              </span>
              <form
                action="/api/auth/logout"
                method="post"
                className="hidden lg:block"
              >
                <Button
                  variant="ghost"
                  type="submit"
                  size="icon"
                  aria-label="Sign out"
                  className="text-muted-foreground"
                >
                  <LogOut aria-hidden />
                  <span className="sr-only">Sign out</span>
                </Button>
              </form>
            </>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden px-3 text-[13px] text-ink-soft sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Button
            asChild
            className="motion-trigger size-11 p-0 sm:w-auto sm:gap-2 sm:px-5 lg:h-12"
            aria-label="Find courts"
          >
            <Link href="/search">
              <Search className="size-4 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">Find courts</span>
              <ArrowUpRight
                className="motion-arrow hidden size-4 sm:block"
                data-direction="up-right"
                aria-hidden
              />
            </Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="ml-1 border-border lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[min(92vw,380px)] gap-0 p-6">
              <SheetHeader className="p-0 pr-12">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
                <SheetDescription>
                  Find a court and get back to the game.
                </SheetDescription>
              </SheetHeader>
              <nav
                aria-label="Menu navigation"
                className="mt-8 flex flex-col gap-2 border-t border-border pt-5"
              >
                {[
                  ...NAV,
                  {
                    href: "/list-your-venue",
                    label: "List your venue",
                    icon: Building2,
                  },
                ].map((item) => (
                  <SheetClose key={item.href} asChild>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        "h-12 justify-start gap-3 px-4 font-medium",
                        active(item.href) && "bg-secondary text-brand-700",
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={active(item.href) ? "page" : undefined}
                      >
                        <item.icon
                          className="size-[18px]"
                          strokeWidth={1.8}
                          aria-hidden
                        />
                        {item.label}
                      </Link>
                    </Button>
                  </SheetClose>
                ))}
              </nav>
              {session ? (
                <form
                  action="/api/auth/logout"
                  method="post"
                  className="mt-auto border-t border-border pt-5"
                >
                  <Button type="submit" variant="outline" block>
                    <LogOut aria-hidden />
                    Sign out
                  </Button>
                </form>
              ) : (
                <div className="mt-auto border-t border-border pt-5">
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    Your next game is waiting.
                  </p>
                  <SheetClose asChild>
                    <Button asChild block>
                      <Link href="/login">
                        Sign in <ArrowUpRight aria-hidden />
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
