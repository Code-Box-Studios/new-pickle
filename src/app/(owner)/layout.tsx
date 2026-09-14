import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveOwnerVenues } from "@/lib/venue/owner-context";
import { OwnerSidebar } from "@/components/nav/OwnerSidebar";
import { OwnerMobileNav } from "@/components/nav/OwnerMobileNav";

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
    <div className="flex min-h-dvh bg-slate-50">
      <OwnerSidebar session={session} activeVenueId={active?.id} />
      {/* Content: offset by sidebar on lg+ */}
      <div className="flex flex-1 flex-col lg:pl-56">
        <main className="flex-1 px-4 py-6 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-6">
          <div className="mx-auto w-full max-w-5xl">
            {children}
          </div>
        </main>
      </div>
      <OwnerMobileNav session={session} activeVenueId={active?.id} />
    </div>
  );
}
