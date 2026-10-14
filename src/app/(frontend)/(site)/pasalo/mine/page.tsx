import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PasaloMine } from "@/components/pasalo/PasaloMine";

export const metadata: Metadata = { title: "My Pasalo", robots: { index: false, follow: false } };

export default async function MyPasaloPage() {
  if (!await getSession()) redirect("/login?next=%2Fpasalo%2Fmine");
  return <PasaloMine />;
}
