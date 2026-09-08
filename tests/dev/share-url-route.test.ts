import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "@/app/api/dev/share-url/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/dev/share-url", () => {
  it("404s in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(new Request("http://localhost:3000/api/dev/share-url"));
    expect(res.status).toBe(404);
  });

  it("returns a payload with candidates in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(
      new Request("http://localhost:3000/api/dev/share-url", { headers: { host: "localhost:3000" } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: unknown[]; url: string | null };
    expect(Array.isArray(body.candidates)).toBe(true);
    // On a machine with no LAN interface, url is null but the shape still holds.
  });
});
