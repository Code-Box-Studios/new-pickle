import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findUnique } = vi.hoisted(() => ({
  findMany: vi.fn(async () => { throw new Error("No database connection"); }),
  findUnique: vi.fn(async () => { throw new Error("No database connection"); }),
}));
vi.mock("@/lib/prisma", () => ({ default: { venue: { findMany, findUnique } } }));

import AdminVenuesPage from "@/app/(frontend)/(admin)/admin/venues/page";
import AdminVenueReview from "@/app/(frontend)/(admin)/admin/venues/[id]/page";

beforeEach(() => vi.stubEnv("APP_PREVIEW_MODE", "true"));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("admin pages rendered alongside their layout", () => {
  it("redirects the list before accessing private venue data", async () => {
    await expect(AdminVenuesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("redirects the review before accessing private venue data", async () => {
    await expect(AdminVenueReview({ params: Promise.resolve({ id: "private-venue" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(findUnique).not.toHaveBeenCalled();
  });
});
