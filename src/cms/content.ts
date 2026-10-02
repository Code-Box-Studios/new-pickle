import "server-only";
import { cache } from "react";
import { getPayload, type GlobalSlug } from "payload";
import { homeDefaults, siteDefaults, venueLandingDefaults } from "./defaults";
import { loadPublishedContent } from "./published";

async function publishedContent<T extends object>(
  slug: GlobalSlug,
  fallback: T,
): Promise<T> {
  if (!process.env.PAYLOAD_SECRET) return fallback;
  return loadPublishedContent(async () => {
    const { default: config } = await import("@/payload.config");
    const payload = await getPayload({ config });
    return (await payload.findGlobal({
      slug,
      draft: false,
      depth: 0,
    })) as unknown as Record<string, unknown>;
  }, fallback);
}
// React cache deduplicates reads within a server render, not across publishes.
export const getHomeContent = cache(() =>
  publishedContent("homepage", homeDefaults),
);
export const getSiteContent = cache(() =>
  publishedContent("site-settings", siteDefaults),
);
export const getVenueLandingContent = cache(() =>
  publishedContent("venue-landing", venueLandingDefaults),
);
