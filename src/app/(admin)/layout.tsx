import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login?next=/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/admin" className="text-lg font-extrabold tracking-tight text-brand-700">
            Rally<span className="text-accent-dark">Point</span>
            <span className="ml-1.5 align-middle text-xs font-semibold text-muted">Admin</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <Link href="/admin/venues" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-black/5">
              Venues
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{session.email}</span>
            <form action="/api/auth/logout" method="post">
              <button className="text-sm font-medium text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
