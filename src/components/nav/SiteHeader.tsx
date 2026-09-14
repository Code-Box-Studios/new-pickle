"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
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
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-brand-700">
          Rally<span className="text-accent-dark">Point</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-black/5",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/list-your-venue"
            className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline"
          >
            List your venue
          </Link>
          {session ? (
            <>
              <NotificationBell />
              <span className="hidden text-sm text-muted sm:inline">{session.email}</span>
              <form action="/api/auth/logout" method="post">
                <button className="text-sm font-medium text-muted hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
