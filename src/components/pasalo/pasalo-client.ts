"use client";

import { useCallback, useEffect, useState } from "react";

export async function pasaloRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Could not complete this request. Please try again.");
  }
  if (data === null) throw new Error("Could not load Pasalo. Please try again.");
  return data as T;
}

export function usePasaloResource<T>(path: string, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await pasaloRequest<T>(path, undefined, signal);
      if (!signal?.aborted) { setData(next); setError(null); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load Pasalo. Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const reload = async () => {
      if (fetching) return;
      fetching = true;
      await refresh(controller.signal);
      fetching = false;
    };
    void reload();
    if (!pollMs) return () => controller.abort();
    const visibleReload = () => { if (document.visibilityState === "visible") void reload(); };
    const timer = window.setInterval(visibleReload, pollMs);
    document.addEventListener("visibilitychange", visibleReload);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleReload);
    };
  }, [refresh, pollMs]);
  return { data, error, loading, refresh };
}
