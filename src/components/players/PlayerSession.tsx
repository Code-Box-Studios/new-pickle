"use client";

import { PlayerRosterCard } from "./PlayerRosterCard";
import { PlayerPrivacy, PlayerShell } from "./PlayerShared";

export function PlayerSession({ bookingId }: { bookingId: string }) {
  return (
    <PlayerShell
      title="Your play session"
      description="Manage your participation, attendance, and shared game results."
      back={{ href: "/players", label: "My player history" }}
    >
      <div className="space-y-5">
        <PlayerPrivacy />
        <PlayerRosterCard bookingId={bookingId} />
      </div>
    </PlayerShell>
  );
}
