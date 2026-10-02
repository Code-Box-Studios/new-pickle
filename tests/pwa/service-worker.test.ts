import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker(online = true) {
  const events = new Map<string, (event: unknown) => void>();
  const offline = new Response("Offline reconnect screen", { status: 200 });
  const match = vi.fn(async () => offline);
  const fetch = online ? vi.fn(async () => new Response("Live private content")) : vi.fn(async () => { throw new Error("offline"); });
  const addAll = vi.fn(async (assets: string[]) => { void assets; });
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://rallypoint.test" }, addEventListener: (name: string, callback: (event: unknown) => void) => events.set(name, callback), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => ({ addAll }), match, keys: async () => [], delete: async () => true },
    fetch, URL,
  });
  return { events, fetch, match, addAll };
}

describe("PWA cache privacy", () => {
  it("never intercepts API responses, mutations, or cross-origin assets", () => {
    const { events } = worker();
    for (const request of [
      { method: "POST", mode: "navigate", url: "https://rallypoint.test/api/bookings" },
      { method: "GET", mode: "cors", url: "https://rallypoint.test/api/cms/globals/homepage" },
      { method: "GET", mode: "cors", url: "https://other.test/brand/rallypoint-mark.svg" },
    ]) {
      const respondWith = vi.fn();
      events.get("fetch")!({ request, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("uses live navigation responses without touching the cache", async () => {
    const { events, match } = worker();
    let response!: Promise<Response>;
    events.get("fetch")!({ request: { method: "GET", mode: "navigate", url: "https://rallypoint.test/bookings" }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response).text()).toBe("Live private content");
    expect(match).not.toHaveBeenCalled();
  });

  it("shows a static reconnect page for failed offline navigation", async () => {
    const { events, match } = worker(false);
    let response!: Promise<Response>;
    events.get("fetch")!({ request: { method: "GET", mode: "navigate", url: "https://rallypoint.test/bookings" }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response).text()).toBe("Offline reconnect screen");
    expect(match).toHaveBeenCalledWith("/offline.html");
  });

  it("pre-caches only the explicit static offline and brand assets", async () => {
    const { events, addAll } = worker();
    let install!: Promise<unknown>;
    events.get("install")!({ waitUntil: (value: Promise<unknown>) => { install = value; } });
    await install;
    const assets = addAll.mock.calls[0][0] as unknown as string[];
    expect(assets).toContain("/offline.html");
    expect(assets.every((url) => url === "/offline.html" || url.startsWith("/brand/"))).toBe(true);
  });
});
