"use client";

import { useCallback, useEffect, useState } from "react";

class PlayerRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function playerRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    cache: "no-store",
    credentials: "same-origin",
    ...(options.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new PlayerRequestError(
      typeof data?.error === "string"
        ? data.error
        : "Could not complete this request. Please try again.",
      response.status,
    );
  if (data === null)
    throw new Error("Could not load player details. Please try again.");
  return data as T;
}

export function playerError(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Could not complete this request. Please try again.";
}

export function usePlayerResource<T>(path: string) {
  const [resource, setResource] = useState<{
    path: string;
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ path, data: null, error: null, loading: true });
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await playerRequest<T>(path, { signal });
        if (!signal?.aborted)
          setResource({ path, data, error: null, loading: false });
      } catch (cause) {
        if (!signal?.aborted)
          setResource((old) => ({
            path,
            data: cause instanceof PlayerRequestError && [401, 403].includes(cause.status) ? null : old.path === path ? old.data : null,
            error: playerError(cause),
            loading: false,
          }));
      }
    },
    [path],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  return {
    ...(resource.path === path
      ? resource
      : { data: null, error: null, loading: true }),
    refresh,
  };
}
