import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPayload, type GlobalSlug } from "payload";
import { homeDefaults, siteDefaults, venueLandingDefaults } from "./defaults";
import { loadPublishedContent } from "./published";
import { isPreviewMode } from "@/lib/deployment";
import { PUBLIC_CONTENT_TAG } from "./cache";

const defaults = {
  homepage: homeDefaults,
  "site-settings": siteDefaults,
  "venue-landing": venueLandingDefaults,
};

const getPublishedGlobal = unstable_cache(
  async (slug: GlobalSlug): Promise<Record<string, unknown>> => {
    const { default: config } = await import("@/payload.config");
    const payload = await getPayload({ config });
    const content = await payload.findGlobal({ slug, draft: false, depth: 0 });
    // Cache only the public fields of a published global. Private drafts and
    // editor metadata never enter the shared cache.
    if (content._status !== "published") return {};
    return {
      _status: "published",
      ...Object.fromEntries(Object.keys(defaults[slug]).map(key => [
        key, (content as unknown as Record<string, unknown>)[key],
      ])),
    };
  },
  ["public-cms-content-v1"],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 },
);

async function publishedContent<T extends object>(
  slug: GlobalSlug,
  fallback: T,
): Promise<T> {
  if (isPreviewMode() || !process.env.PAYLOAD_SECRET) return fallback;
  // Errors and deadline fallbacks stay outside the persistent cache so the
  // next request can retry a transient CMS failure.
  return loadPublishedContent(() => getPublishedGlobal(slug), fallback);
}
// React also deduplicates cache lookups within a server render.
export const getHomeContent = cache(() =>
  publishedContent("homepage", homeDefaults),
);
export const getSiteContent = cache(() =>
  publishedContent("site-settings", siteDefaults),
);
export const getVenueLandingContent = cache(() =>
  publishedContent("venue-landing", venueLandingDefaults),
);
