import type { Payload, GlobalSlug } from "payload";
import { homeDefaults, siteDefaults, venueLandingDefaults } from "./defaults";

/** Seed only missing globals. An existing draft or published edit is preserved. */
export async function seedContent(payload: Payload): Promise<void> {
  async function isMissing(slug: GlobalSlug): Promise<boolean> {
    const doc = await payload.findGlobal({ slug, draft: true });
    if (doc.id) return false;
    // A first draft exists only in the version table and has no document ID.
    const versions = await payload.findGlobalVersions({ slug, limit: 1 });
    return versions.totalDocs === 0;
  }
  if (await isMissing("homepage"))
    await payload.updateGlobal({
      slug: "homepage",
      data: { ...homeDefaults, _status: "published" },
      draft: false,
    });
  if (await isMissing("site-settings"))
    await payload.updateGlobal({
      slug: "site-settings",
      data: { ...siteDefaults, _status: "published" },
      draft: false,
    });
  if (await isMissing("venue-landing"))
    await payload.updateGlobal({
      slug: "venue-landing",
      data: { ...venueLandingDefaults, _status: "published" },
      draft: false,
    });
}
