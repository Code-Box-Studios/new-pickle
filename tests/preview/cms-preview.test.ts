import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/app/(payload)/cms/importMap", () => ({ importMap: {} }));
vi.mock("@payloadcms/next/views", () => ({
  RootPage: async () => "CMS content",
  NotFoundPage: vi.fn(async () => "CMS not found"),
  generatePageMetadata: async () => ({ title: "Editor" }),
}));
import Page, { generateMetadata } from "@/app/(payload)/cms/[[...segments]]/page";
import NotFound from "@/app/(payload)/cms/[[...segments]]/not-found";
import { NotFoundPage } from "@payloadcms/next/views";

beforeEach(() => vi.stubEnv("APP_PREVIEW_MODE", "true"));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const args = { params: Promise.resolve({ segments: [] }), searchParams: Promise.resolve({}) };

describe("CMS access during public preview", () => {
  it("redirects before rendering the private editor", () => {
    expect(() => Page(args)).toThrow("NEXT_REDIRECT");
  });

  it("uses public-safe metadata without querying CMS", async () => {
    expect(await generateMetadata(args)).toMatchObject({ robots: { index: false, follow: false } });
  });

  it("redirects the not-found boundary before initializing Payload", () => {
    expect(() => NotFound()).toThrow("NEXT_REDIRECT");
    expect(NotFoundPage).not.toHaveBeenCalled();
  });

  it("keeps the CMS not-found page available outside preview", async () => {
    vi.stubEnv("APP_PREVIEW_MODE", "false");
    expect(await NotFound()).toBe("CMS not found");
  });
});
