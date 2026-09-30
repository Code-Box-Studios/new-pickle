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
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
        expired ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800",
      )}
      role="timer"
      aria-live="off"
    >
      <Clock className="size-4" aria-hidden />
      {expired ? "Hold expired" : `${text} left`}
    </span>
  );
}
