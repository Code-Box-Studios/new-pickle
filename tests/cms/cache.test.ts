import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Next installs this global in its Node runtime before loading cache modules.
await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  Object.assign(globalThis, { AsyncLocalStorage });
});
const provider = vi.hoisted(() => ({ findGlobal: vi.fn() }));
vi.mock("payload", () => ({ getPayload: async () => provider }));
vi.mock("@/payload.config", () => ({ default: {} }));

import { getHomeContent } from "@/cms/content";
import { contentGlobals } from "@/cms/globals";
import { homeDefaults } from "@/cms/defaults";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import type { GlobalAfterChangeHook } from "payload";

type CacheEntry = { value: { data: { body: string } }; tags: string[] };
// Exercise Next's actual unstable_cache/revalidateTag with an isolated backing
// store. Only the external CMS query and persistence boundary are replaced.
class TestCache {
  entries = new Map<string, CacheEntry>();
  async generateSimpleCacheKey(input: string) { return input; }
  async get(key: string) { return this.entries.get(key) ?? null; }
  async set(key: string, value: CacheEntry["value"], { tags }: { tags: string[] }) {
    this.entries.set(key, { value, tags });
  }
  expire(tag: string) {
    for (const [key, entry] of this.entries) {
      if (entry.tags.includes(tag)) this.entries.delete(key);
    }
  }
}
let backing: TestCache;
beforeEach(() => {
  backing = new TestCache();
  vi.stubGlobal("__incrementalCache", backing);
  vi.stubEnv("PAYLOAD_SECRET", "test-secret");
  vi.stubEnv("APP_PREVIEW_MODE", "false");
  provider.findGlobal.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const homepage = contentGlobals.find(global => global.slug === "homepage")!;
async function change(doc: Record<string, unknown>, previousDoc: Record<string, unknown>) {
  const store = {
    route: "/api/cms/globals/homepage",
    incrementalCache: backing,
    pendingRevalidatedTags: [] as { tag: string; profile: { expire?: number } }[],
  };
  const hook = homepage.hooks?.afterChange?.[0];
  if (hook) {
    await workAsyncStorage.run(store as never, () => hook({
      doc, previousDoc, data: doc, global: homepage,
      req: { payloadAPI: "REST", context: {} }, context: {},
    } as Parameters<GlobalAfterChangeHook>[0]));
  }
  // Next flushes these tags at the end of the CMS request, after Payload commits.
  for (const entry of store.pendingRevalidatedTags) {
    expect(entry.profile.expire).toBe(0);
    backing.expire(entry.tag);
  }
}

describe("public CMS cache", () => {
  it("reuses published content across requests and stores only public fields", async () => {
    provider.findGlobal.mockResolvedValue({
      ...homeDefaults, _status: "published", heroTitle: "Published title",
      privateEditorNote: "Do not cache this",
    });
    expect((await getHomeContent()).heroTitle).toBe("Published title");
    expect((await getHomeContent()).heroTitle).toBe("Published title");
    expect(provider.findGlobal).toHaveBeenCalledTimes(1);
    expect(backing.entries.size).toBe(1);
    expect([...backing.entries.values()][0].value.data.body).not.toContain("privateEditorNote");
  });

  it("retries after a failed CMS request without caching fallback content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    provider.findGlobal.mockRejectedValueOnce(new Error("Temporary connection error"));
    expect(await getHomeContent()).toEqual(homeDefaults);
    expect(backing.entries.size).toBe(0);
    provider.findGlobal.mockResolvedValue({ ...homeDefaults, _status: "published", heroTitle: "Recovered" });
    expect((await getHomeContent()).heroTitle).toBe("Recovered");
    expect(backing.entries.size).toBe(1);
  });

  it("expires cached content after publishing and unpublishing", async () => {
    provider.findGlobal.mockResolvedValue({ ...homeDefaults, _status: "published", heroTitle: "First title" });
    expect((await getHomeContent()).heroTitle).toBe("First title");
    provider.findGlobal.mockResolvedValue({ ...homeDefaults, _status: "published", heroTitle: "Updated title" });
    await change({ _status: "published" }, { _status: "published" });
    expect((await getHomeContent()).heroTitle).toBe("Updated title");
    provider.findGlobal.mockResolvedValue({ ...homeDefaults, _status: "draft", heroTitle: "Private draft" });
    await change({ _status: "draft" }, { _status: "published" });
    expect(await getHomeContent()).toEqual(homeDefaults);
    expect([...backing.entries.values()].map(entry => entry.value.data.body).join("")).not.toContain("Private draft");
  });

  it("retries after a CMS timeout without caching the timeout fallback", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    provider.findGlobal.mockImplementationOnce(() => new Promise(() => {}));
    const timedOut = getHomeContent();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await timedOut).toEqual(homeDefaults);
    expect(backing.entries.size).toBe(0);
    provider.findGlobal.mockResolvedValue({ ...homeDefaults, _status: "published", heroTitle: "Recovered after timeout" });
    expect((await getHomeContent()).heroTitle).toBe("Recovered after timeout");
  });

  it("allows local CMS scripts outside the Next request runtime", async () => {
    const hook = homepage.hooks?.afterChange?.[0];
    expect(hook).toBeDefined();
    await expect(hook!({
      doc: { _status: "published" }, previousDoc: {}, data: {}, global: homepage,
      req: { payloadAPI: "local", context: {} }, context: {},
    } as Parameters<GlobalAfterChangeHook>[0])).resolves.toEqual({ _status: "published" });
  });
});
