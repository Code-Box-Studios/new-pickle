import Link from "next/link";
import { LayoutDashboard, CalendarDays, BookOpen, Star, Building2 } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

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
  session: { email: string };
  activeVenueId?: string;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-black/5 bg-white lg:flex">
      {/* Wordmark */}
      <div className="flex h-16 items-center border-b border-black/5 px-5">
        <Link
          href="/owner"
          className="text-[15px] font-extrabold tracking-tight text-brand-700"
        >
          Rally<span className="text-accent-dark">Point</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const href =
            activeVenueId && item.href !== "/owner"
              ? `${item.href}?venue=${activeVenueId}`
              : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/5 hover:text-ink"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: notifications + account */}
      <div className="border-t border-black/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="min-w-0 truncate text-xs text-muted">{session.email}</span>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button type="submit" className="text-sm font-medium text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
