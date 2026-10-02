"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  MoreHorizontal,
  Star,
  Building2,
  LogOut,
  FilePenLine,
  ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

const BOTTOM_TABS = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/owner/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/owner/reservations", label: "Reservations", icon: BookOpen },
];

const MORE_ITEMS = [
  { href: "/owner/reviews", label: "Reviews", icon: Star },
  { href: "/owner/venues", label: "Venues", icon: Building2 },
];

export function OwnerMobileNav({
  session,
  activeVenueId,
}: {
  session: { email: string | null; mobile?: string | null; role?: string };
  activeVenueId?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = [
    ...MORE_ITEMS,
    ...(session.role === "ADMIN"
      ? [{ href: "/cms", label: "Edit website", icon: FilePenLine }]
      : []),
  ];
  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));
  const venueHref = (href: string) =>
    activeVenueId && href !== "/cms" ? `${href}?venue=${activeVenueId}` : href;

  return (
    <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
      <nav
        aria-label="Owner navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg px-2">
          {BOTTOM_TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Button
                  asChild
                  variant="ghost"
                  className={cn(
                    "h-auto p-0",
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                    active
                      ? "text-brand-700"
                      : "text-muted-foreground hover:text-ink",
                  )}
                >
                  <Link
                    href={venueHref(tab.href)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-10 place-items-center rounded-lg",
                        active && "bg-mist",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {tab.label}
                  </Link>
                </Button>
              </li>
            );
          })}
          <li className="flex-1">
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                aria-label="More"
                className={cn(
                  "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                  moreOpen || moreActive
                    ? "text-brand-700"
                    : "text-muted-foreground hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-10 place-items-center rounded-lg",
                    (moreOpen || moreActive) && "bg-mist",
                  )}
                >
                  <MoreHorizontal className="size-5" aria-hidden />
                </span>
                More
              </Button>
            </DialogTrigger>
          </li>
        </ul>
      </nav>
      <DialogContent title="More">
        <nav aria-label="More owner navigation" className="space-y-2">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn(
                  "h-auto p-0",
                  "motion-trigger flex min-h-14 items-center gap-3 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  active
                    ? "bg-mist text-brand-700"
                    : "bg-canvas text-ink-soft hover:bg-mist",
                )}
              >
                <Link
                  href={venueHref(item.href)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                  <ChevronRight
                    className="motion-arrow ml-auto size-4 text-muted-foreground"
                    data-direction="right"
                    aria-hidden
                  />
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="mt-5 border-t border-line pt-4">
          <p className="break-all px-1 text-xs text-muted-foreground">
            {session.email ?? session.mobile ?? "Your account"}
          </p>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <Button
              variant="ghost"
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
