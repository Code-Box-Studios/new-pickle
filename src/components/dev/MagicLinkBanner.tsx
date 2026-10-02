"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";

/** Dev-only: surfaces the latest magic link so you can log in without SMTP. */
export function MagicLinkBanner() {
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/dev/last-magic-link");
        if (!res.ok) return;
        const data = (await res.json()) as {
          links: { email: string; url: string }[];
        };
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

  if (
    process.env.NODE_ENV === "production" ||
    !link ||
    link.url === dismissedUrl
  )
    return null;

  return (
    <div className="relative z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-950">
      <KeyRound className="size-3.5" aria-hidden />
      <span className="truncate">
        Dev magic link for <strong>{link.email}</strong>
      </span>
      <a
        href={link.url}
        onClick={() => setDismissedUrl(link.url)}
        className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline underline-offset-4 hover:bg-amber-950/10"
      >
        Open link →
      </a>
      <Button
        variant="ghost"
        type="button"
        onClick={() => setDismissedUrl(link.url)}
        aria-label="Dismiss magic link"
        className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-amber-950/10"
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
