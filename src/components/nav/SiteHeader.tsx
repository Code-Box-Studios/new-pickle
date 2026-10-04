"use client";

import { useSyncExternalStore } from "react";
import { NavigationLink as Link } from "@/components/nav/NavigationLink";
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
  FilePenLine,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import { PaddleIcon, PickleballIcon } from "@/components/ui/pickleball";
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
import { siteDefaults, type SiteContent } from "@/cms/defaults";

const BASE_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Explore", icon: Search },
  { href: "/bookings", label: "My bookings", icon: CalendarCheck },
];

const DARK_INTRO_ROUTES = new Set(["/", "/login", "/signup", "/list-your-venue", "/owner/login", "/owner/verify"]);

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function getScrolledSnapshot() {
  return window.scrollY > 16;
}

function getServerScrolledSnapshot() {
  return false;
}

export function SiteHeader({
  session,
  content = siteDefaults,
}: {
  session: SessionUser | null;
  content?: SiteContent;
}) {
  const NAV = BASE_NAV.map((item, index) => ({
    ...item,
    label: [content.homeLabel, content.exploreLabel, content.bookingsLabel][
      index
    ],
  }));
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    getScrolledSnapshot,
    getServerScrolledSnapshot,
  );
  const overlaysHero = DARK_INTRO_ROUTES.has(pathname);
  const transparent = overlaysHero && !scrolled;
  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);
  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 px-3 py-3 sm:px-6 lg:px-8",
        overlaysHero
          ? "-mb-[88px] bg-transparent lg:-mb-24"
          : "bg-surface/85 backdrop-blur-xl",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 max-w-[1280px] items-center gap-2 rounded-[20px] border px-3 transition-[background-color,border-color,box-shadow] duration-300 ease-out sm:gap-4 sm:px-5 lg:h-[72px] lg:gap-6 lg:px-6",
          transparent
            ? "border-transparent bg-transparent shadow-none"
            : "border-border/80 bg-white shadow-[0_4px_24px_-12px_rgb(0_30_43/0.16)]",
        )}
      >
        <Link
          href="/#top"
          className="brand-link group flex min-h-11 shrink-0 items-center rounded-xl"
          aria-label="Pikol home"
        >
          <Brand
            inverse={transparent}
            className="gap-2 text-[22px] transition-colors duration-300 sm:gap-3 sm:text-[25px]"
          />
        </Link>
        <nav
          aria-label="Main navigation"
          className="mx-auto hidden min-w-0 items-center gap-1.5 lg:flex"
        >
          {NAV.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "h-11 max-w-40 gap-2 px-4 text-[13px] font-medium transition-colors duration-200",
                active(item.href)
                  ? transparent
                    ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/10 hover:text-white active:bg-white/15"
                    : "bg-brand-950 text-white shadow-[0_3px_10px_-3px_rgb(0_30_43/0.24)] hover:bg-brand-950 hover:text-white active:bg-brand-950"
                  : transparent
                    ? "text-white/75 hover:bg-white/5 hover:text-white active:bg-white/10"
                    : "text-ink-soft hover:bg-surface",
              )}
            >
              <Link
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active(item.href) && "text-primary",
                  )}
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
          <Button
            asChild
            variant="ghost"
            className={cn(
              "hidden max-w-36 gap-2 px-3 text-[13px] font-medium xl:inline-flex",
              transparent
                ? "text-white/75 hover:bg-white/5 hover:text-white active:bg-white/10"
                : "text-ink-soft",
            )}
          >
            <Link
              href={session?.role === "ADMIN" ? "/cms" : "/list-your-venue"}
            >
              {session?.role === "ADMIN" ? (
                <FilePenLine className="size-4" aria-hidden />
              ) : (
                <Building2 className="size-4" aria-hidden />
              )}
              <span className="truncate">
                {session?.role === "ADMIN"
                  ? "Edit website"
                  : content.venueLabel}
              </span>
            </Link>
          </Button>
          {session ? (
            <>
              <NotificationBell inverse={transparent} />
              <span
                className="sr-only"
                title={session.email ?? session.mobile ?? undefined}
              >
                {session.email ?? session.mobile}
              </span>
              <form
                action="/api/auth/logout"
                method="post"
                className="hidden lg:block"
              >
                <Button
                  variant={transparent ? "outlineOnDark" : "ghost"}
                  type="submit"
                  size="icon"
                  aria-label="Sign out"
                  className={cn(
                    "border",
                    transparent
                      ? "border-white/25 bg-white/5 text-white/80"
                      : "border-border/70 bg-surface/60 text-muted-foreground",
                  )}
                >
                  <LogOut aria-hidden />
                  <span className="sr-only">Sign out</span>
                </Button>
              </form>
            </>
          ) : (
            <Button
              asChild
              variant={transparent ? "outlineOnDark" : "outline"}
              className={cn(
                "hidden max-w-32 gap-2 px-4 text-[13px] sm:inline-flex",
                transparent
                  ? "border-white/25 text-white"
                  : "border-border/80 text-ink",
              )}
            >
              <Link href="/login">
                <UserRound className="size-4" strokeWidth={1.8} aria-hidden />
                <span className="truncate">{content.signInLabel}</span>
              </Link>
            </Button>
          )}
          <Button
            asChild
            className="motion-trigger size-11 p-0 shadow-[0_3px_10px_-4px_rgb(0_104_74/0.24)] sm:w-auto sm:gap-2 sm:px-5"
            aria-label={content.searchLabel}
          >
            <Link href="/search">
              <Search className="size-4 sm:hidden" aria-hidden />
              <PickleballIcon className="hidden size-4 sm:block" />
              <span className="hidden sm:inline">
                {content.searchLabel}
              </span>
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
                variant={transparent ? "outlineOnDark" : "outline"}
                size="icon"
                className={cn(
                  "lg:hidden",
                  transparent
                    ? "border-white/25 bg-white/5 text-white"
                    : "border-border/80 bg-surface/60",
                )}
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              showCloseButton={false}
              className="top-[max(12px,env(safe-area-inset-top))] right-3 bottom-[max(12px,env(safe-area-inset-bottom))] h-auto w-[calc(100vw-24px)] max-w-[400px] gap-0 overflow-hidden rounded-3xl border border-border/70 p-0 sm:max-w-[400px]"
            >
              <div className="relative shrink-0 overflow-hidden bg-brand-950 p-5 text-white">
                <PaddleIcon className="pointer-events-none absolute -bottom-8 right-10 size-32 rotate-12 text-brand-300/10" />
                <SheetHeader className="relative gap-4 p-0">
                  <div className="flex items-center justify-between gap-3">
                    <SheetTitle>
                      <Brand inverse className="text-[26px]" />
                    </SheetTitle>
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        aria-label="Close menu"
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                    </SheetClose>
                  </div>
                  <SheetDescription className="max-w-56 text-sm leading-relaxed text-white/65">
                    Find a court and get back to the game.
                  </SheetDescription>
                </SheetHeader>
              </div>
              <nav
                aria-label="Menu navigation"
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-4"
              >
                {[
                  ...NAV,
                  ...(session?.role === "ADMIN"
                    ? [
                        {
                          href: "/cms",
                          label: "Edit website",
                          icon: FilePenLine,
                        },
                      ]
                    : []),
                  {
                    href: "/list-your-venue",
                    label: content.venueLabel,
                    icon: Building2,
                  },
                ].map((item) => (
                  <SheetClose key={item.href} asChild>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        "h-14 shrink-0 justify-between gap-3 border border-transparent px-4 text-[15px] font-medium",
                        active(item.href)
                          ? "border-brand-950 bg-brand-950 text-white hover:bg-brand-950 hover:text-white"
                          : "bg-surface/70 text-ink-soft",
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={active(item.href) ? "page" : undefined}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <item.icon
                            className={cn(
                              "size-[18px] shrink-0",
                              active(item.href) && "text-primary",
                            )}
                            strokeWidth={1.8}
                            aria-hidden
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <ArrowUpRight
                          className={cn(
                            "size-4 shrink-0",
                            active(item.href)
                              ? "text-primary"
                              : "text-muted-foreground/60",
                          )}
                          aria-hidden
                        />
                      </Link>
                    </Button>
                  </SheetClose>
                ))}
              </nav>
              {session ? (
                <form
                  action="/api/auth/logout"
                  method="post"
                  className="shrink-0 border-t border-border/70 p-5"
                >
                  <Button type="submit" variant="outline" block>
                    <LogOut aria-hidden />
                    Sign out
                  </Button>
                </form>
              ) : (
                <div className="shrink-0 border-t border-border/70 p-5">
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    Your next game is waiting.
                  </p>
                  <SheetClose asChild>
                    <Button asChild block>
                      <Link href="/login">
                        {content.signInLabel} <ArrowUpRight aria-hidden />
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
