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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                  active ? "text-brand-700" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
