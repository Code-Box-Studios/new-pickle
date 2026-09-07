import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Explore" },
  { href: "/bookings", label: "My bookings" },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-brand-700">
          Rally<span className="text-accent-dark">Point</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-black/5"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
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
