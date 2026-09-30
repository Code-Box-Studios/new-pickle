"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

interface NItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NItem[]>([]);

  const loadCount = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications/unread-count");
      if (r.ok) setUnread((await r.json()).count);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) {
        const d = await r.json();
        setItems(d.items);
        setUnread(d.unread);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // State is set only after an awaited fetch (a microtask), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCount();
    const iv = setInterval(loadCount, 30_000);
    return () => clearInterval(iv);
  }, [loadCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void loadList();
  }, [open, loadList]);

  async function openItem(n: NItem) {
    if (!n.readAt) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    void loadCount();
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      /* ignore */
    }
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative grid size-11 place-items-center rounded-xl transition-colors hover:bg-mist"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="size-5 text-ink-soft" strokeWidth={1.8} aria-hidden />
          {unread > 0 && (
            <span className="absolute right-0 top-0 min-w-4 rounded-full bg-brand-700 px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent title="Notifications">
        <div className="-mt-2 mb-2 flex justify-end">
          <button type="button" onClick={markAll} className="min-h-11 rounded-lg px-2 text-sm font-medium text-brand-700 hover:underline">
            Mark all read
          </button>
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-canvas px-5 py-12 text-center text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full gap-3 rounded-xl p-4 text-left transition-colors hover:bg-mist",
                    !n.readAt && "bg-brand-50/60",
                  )}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="mt-1 block text-sm leading-relaxed text-muted">{n.body}</span>}
                    <span className="mt-2 block text-xs text-muted">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
