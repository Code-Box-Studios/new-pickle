import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PlayerDashboard } from "@/components/players/PlayerDashboard";

export const metadata: Metadata = {
  title: "My player history",
  robots: { index: false, follow: false },
};

export default async function PlayersPage() {
  if (!(await getSession())) redirect("/login?next=%2Fplayers");
  return <PlayerDashboard />;
}
