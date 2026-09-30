"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Explore" },
  { href: "/bookings", label: "My bookings" },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur-sm">
      <div className="page-shell flex h-18 items-center gap-4">
        <Link href="/" className="shrink-0 rounded-xl" aria-label="RallyPoint home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors",
                  active ? "bg-mist text-brand-800" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/list-your-venue"
            className="hidden min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas hover:text-ink lg:inline-flex"
          >
            List your venue
          </Link>
          {session ? (
            <>
              <NotificationBell />
              <span className="hidden max-w-40 truncate text-sm text-muted xl:inline" title={session.email}>{session.email}</span>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-canvas hover:text-ink">
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({size: "sm"})}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
