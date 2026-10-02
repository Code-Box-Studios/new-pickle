import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveOwnerVenues } from "@/lib/venue/owner-context";
import { OwnerSidebar } from "@/components/nav/OwnerSidebar";
import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";
import { NavigationLink as Link } from "@/components/nav/NavigationLink";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !["OWNER", "STAFF", "ADMIN"].includes(session.role)) {
    redirect("/login?next=/owner");
  }
  // Resolve active venue for nav links (venue-scoped URLs)
  const { active } = await resolveOwnerVenues(session, undefined);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <OwnerSidebar session={session} activeVenueId={active?.id} />
      {/* Content: offset by sidebar on lg+ */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="hidden h-20 shrink-0 items-center justify-between gap-6 border-b border-border/80 bg-white px-10 lg:flex">
          <div>
            <p className="text-sm font-medium text-ink">Venue workspace</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your courts, your community.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/#top">
              Open marketplace <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-7 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 sm:py-9 lg:px-10 lg:pb-10"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <OwnerMobileNav session={session} activeVenueId={active?.id} />
    </div>
  );
}
