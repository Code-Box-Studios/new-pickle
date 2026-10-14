import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { PlayerInvitation } from "@/components/players/PlayerInvitation";

export const metadata: Metadata = {
  title: "Player invitation",
  robots: { index: false, follow: false },
};

export default async function PlayerInvitePage() {
  const session = await getSession();
  const initialToken = (await cookies()).get("pikol-player-invite")?.value;
  return (
    <PlayerInvitation initialToken={initialToken} isAuthed={Boolean(session)} />
  );
}
