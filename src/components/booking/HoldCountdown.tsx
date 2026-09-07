"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Server-authoritative countdown: derives remaining time from the server's
 * `expiresAt` and the client clock. It never resets on refresh (the server
 * timestamp is fixed), and it doesn't control anything — the server enforces
 * expiry. `remainingMs` is null until mounted to avoid hydration mismatch.
 */
export function useCountdown(expiresAtIso: string) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () =>
      setRemainingMs(Math.max(0, new Date(expiresAtIso).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);
  return { remainingMs, expired: remainingMs !== null && remainingMs <= 0 };
}

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const { remainingMs, expired } = useCountdown(expiresAt);

  let text = "--:--";
  if (remainingMs !== null) {
    const total = Math.floor(remainingMs / 1000);
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    text = `${mm}:${ss.toString().padStart(2, "0")}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
        expired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800",
      )}
    >
      <Clock className="size-4" aria-hidden />
      {expired ? "Hold expired" : `${text} left`}
    </span>
  );
}
