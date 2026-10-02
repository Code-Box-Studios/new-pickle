import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ArrowUpRight, Building2, LogOut } from "lucide-react";
import { Brand } from "@/components/ui/brand";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login?next=/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-teal-deep text-white lg:flex">
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <Link
            href="/admin"
            className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-brand-teal-deep"
          >
            <Brand inverse />
            <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Admin
            </span>
          </Link>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 px-4 py-6">
          <p className="mb-4 px-3 text-[10px] font-medium uppercase tracking-[1.5px] text-white/40">
            Platform
          </p>
          <Button
            asChild
            variant="ghost"
            className={cn(
              "h-auto p-0",
              "flex min-h-12 w-full items-center justify-start gap-3 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary ring-1 ring-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            )}
          >
            <Link href="/admin/venues" aria-current="page">
              <Building2 className="size-5 shrink-0" aria-hidden />
              Venues
            </Link>
          </Button>
        </nav>
        <div className="border-t border-white/10 px-6 py-5">
          <p className="truncate text-xs text-white/65">{session.email}</p>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <Button
              variant="ghost"
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-white/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      {/* Mobile header — keep simple for admin (no mobile nav needed, admin is desktop-primary) */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link
            href="/admin"
            className="flex items-center rounded-lg text-lg font-semibold tracking-tight text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Brand className="text-lg" />
            <span className="sr-only ml-1.5 text-[11px] font-semibold text-muted-foreground sm:not-sr-only">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              className={cn(
                "h-auto p-0",
                "flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              )}
            >
              <Link href="/admin/venues" aria-current="page">
                Venues
              </Link>
            </Button>
            <form action="/api/auth/logout" method="post">
              <Button
                variant="ghost"
                type="submit"
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="hidden h-20 shrink-0 items-center justify-between gap-6 border-b border-border/80 bg-white px-10 lg:flex">
          <div>
            <p className="text-sm font-medium text-ink">Platform workspace</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage venues and keep the community playing.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              Open marketplace <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-7 outline-none sm:px-6 sm:py-9 lg:px-10"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
