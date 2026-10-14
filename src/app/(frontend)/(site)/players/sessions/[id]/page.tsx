import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PlayerSession } from "@/components/players/PlayerSession";

export const metadata: Metadata = {
  title: "Private play session",
  robots: { index: false, follow: false },
};

export default async function PlayerSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getSession()))
    redirect(`/login?next=${encodeURIComponent(`/players/sessions/${id}`)}`);
  return <PlayerSession bookingId={id} />;
}
