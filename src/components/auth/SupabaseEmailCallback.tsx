"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLoading } from "@/components/ui/page-loading";
import { safeNextPath } from "@/lib/auth/redirect";

/** URL fragments never reach route handlers; import default email sessions after hydration. */
export function SupabaseEmailCallback() {
  const router = useRouter();
  const attempt = useRef<Promise<string> | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const isCallback = ["access_token", "refresh_token", "error", "error_code"].some(key => fragment.has(key));
    if (!isCallback && !attempt.current) return;
    let active = true;

    if (!attempt.current) {
      const clean = new URL(window.location.href);
      clean.hash = "";
      clean.searchParams.delete("error");
      // Scrub credentials before any request or navigation, preserving Next.js history state.
      window.history.replaceState(window.history.state, "", clean.pathname + clean.search);
      let next = safeNextPath(clean.searchParams.get("next"));
      if (fragment.get("type") === "recovery" && (!next || new URL(next, clean.origin).pathname !== "/reset-password")) {
        const reset = new URL("/reset-password", clean.origin);
        if (next) reset.searchParams.set("next", next);
        next = reset.pathname + reset.search;
      }
      const failure = new URLSearchParams({ error: "invalid", ...(next ? { next } : {}) });
      const failedDestination = `/login?${failure}`;

      attempt.current = (async () => {
        const access_token = fragment.get("access_token");
        const refresh_token = fragment.get("refresh_token");
        if (fragment.has("error") || fragment.has("error_code") || !access_token || !refresh_token) return failedDestination;
        try {
          const response = await fetch("/api/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({ access_token, refresh_token, next }),
          });
          const data = await response.json();
          return response.ok && data.ok ? safeNextPath(data.next) ?? failedDestination : failedDestination;
        } catch {
          return failedDestination;
        }
      })();
    }

    // Reuse the exchange during Strict Mode's effect replay: a refresh token may rotate once.
    setCompleting(true);
    attempt.current.then(destination => {
      if (!active) return;
      router.replace(destination);
      router.refresh();
      setCompleting(false);
    });
    return () => { active = false; };
  }, [router]);

  if (!completing) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-white"><PageLoading /></div>;
}
