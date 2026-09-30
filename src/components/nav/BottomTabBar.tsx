"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/search", label: "Explore", icon: Search },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/login", label: "Account", icon: User },
];

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-[11px] font-medium transition-colors",
                  active ? "text-brand-800" : "text-muted hover:text-ink",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-xl", active && "bg-mist")}>
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
