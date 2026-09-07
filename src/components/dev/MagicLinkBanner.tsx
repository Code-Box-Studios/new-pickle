"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

/** Dev-only: surfaces the latest magic link so you can log in without SMTP. */
export function MagicLinkBanner() {
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/dev/last-magic-link");
        if (!res.ok) return;
        const data = (await res.json()) as { links: { email: string; url: string }[] };
        if (active) setLink(data.links.at(-1) ?? null);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (process.env.NODE_ENV === "production" || !link) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[95] flex items-center justify-center gap-2 bg-amber-400 px-3 py-1.5 text-center text-xs font-medium text-amber-950">
      <KeyRound className="size-3.5" aria-hidden />
      <span className="truncate">
        Dev magic link for <strong>{link.email}</strong>
      </span>
      <a
        href={link.url}
        className="rounded-md bg-amber-950/10 px-2 py-0.5 font-semibold underline underline-offset-2 hover:bg-amber-950/20"
      >
        Open link →
      </a>
    </div>
  );
}
