"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";

const BOTTOM_TABS = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/owner/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/owner/reservations", label: "Reservations", icon: BookOpen },
];

const MORE_ITEMS = [
  { href: "/owner/reviews", label: "Reviews" },
  { href: "/owner/venues", label: "Venues" },
];

export function OwnerMobileNav({
  session,
  activeVenueId,
}: {
  session: { email: string };
  activeVenueId?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 rounded-t-2xl border-t border-black/5 bg-white px-4 pb-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            More
          </p>
          {MORE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={
                activeVenueId
                  ? `${item.href}?venue=${activeVenueId}`
                  : item.href
              }
              className="flex items-center py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
              onClick={() => setMoreOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-black/5 pt-2">
            <p className="text-xs text-muted">{session.email}</p>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="mt-1 text-sm font-medium text-muted hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {BOTTOM_TABS.map((t) => {
            const active = t.exact
              ? pathname === t.href
              : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={
                    activeVenueId ? `${t.href}?venue=${activeVenueId}` : t.href
                  }
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    active ? "text-brand-700" : "text-muted",
                  )}
                >
                  <Icon className="size-[22px]" aria-hidden />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                moreOpen ? "text-brand-700" : "text-muted",
              )}
            >
              <MoreHorizontal className="size-[22px]" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
