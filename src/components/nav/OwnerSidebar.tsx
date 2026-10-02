"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Star,
  Building2,
  LogOut,
  FilePenLine,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Brand } from "@/components/ui/brand";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/owner/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/owner/reservations", label: "Reservations", icon: BookOpen },
  { href: "/owner/reviews", label: "Reviews", icon: Star },
  { href: "/owner/venues", label: "Venues", icon: Building2 },
];

export function OwnerSidebar({
  session,
  activeVenueId,
}: {
  session: { email: string; role?: string };
  activeVenueId?: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-teal-deep text-white lg:flex">
      {/* Wordmark */}
      <div className="flex h-20 items-center border-b border-white/10 px-6">
        <Link
          href="/owner"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-brand-teal-deep"
        >
          <Brand inverse />
        </Link>
      </div>

      {/* Nav */}
      <nav
        aria-label="Owner navigation"
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <p className="mb-4 px-3 text-[10px] font-medium uppercase tracking-[1.5px] text-white/40">
          Workspace
        </p>
        {[
          ...NAV,
          ...(session.role === "ADMIN"
            ? [{ href: "/cms", label: "Edit website", icon: FilePenLine }]
            : []),
        ].map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const href =
            activeVenueId && item.href !== "/owner" && item.href !== "/cms"
              ? `${item.href}?venue=${activeVenueId}`
              : item.href;
          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "h-auto p-0",
                "mb-1.5 flex min-h-12 w-full items-center justify-start gap-3 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                active
                  ? "bg-primary/10 font-semibold text-primary ring-1 ring-primary/15"
                  : "text-white/65 hover:bg-white/7 hover:text-white",
              )}
            >
              <Link href={href} aria-current={active ? "page" : undefined}>
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* Bottom: notifications + account */}
      <div className="border-t border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="shrink-0 [&_button]:size-11 [&_button]:hover:bg-white/10 [&_svg]:text-white/75">
            <NotificationBell />
          </div>
          <span className="min-w-0 truncate text-xs text-white/65">
            {session.email}
          </span>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <Button
            variant="ghost"
            type="submit"
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-white/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
