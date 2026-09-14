import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Building2 } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login?next=/admin");

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-black/5 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-black/5 px-5">
          <Link href="/admin" className="text-[15px] font-extrabold tracking-tight text-brand-700">
            Rally<span className="text-accent-dark">Point</span>
            <span className="ml-1.5 align-middle text-[11px] font-semibold text-muted">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 py-3">
          <Link href="/admin/venues" className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/5 hover:text-ink">
            <Building2 className="size-4 shrink-0" aria-hidden />
            Venues
          </Link>
        </nav>
        <div className="border-t border-black/5 px-5 py-4">
          <p className="text-xs text-muted">{session.email}</p>
          <form action="/api/auth/logout" method="post" className="mt-1">
            <button className="text-sm font-medium text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </aside>
      {/* Mobile header — keep simple for admin (no mobile nav needed, admin is desktop-primary) */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/admin" className="text-[15px] font-extrabold tracking-tight text-brand-700">
            Rally<span className="text-accent-dark">Point</span>
            <span className="ml-1.5 text-[11px] font-semibold text-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/admin/venues" className="text-sm font-medium text-ink-soft">Venues</Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-sm font-medium text-muted">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {/* Content */}
      <div className="flex flex-1 flex-col lg:pl-56">
        <main className="flex-1 px-4 py-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
