import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseStorage } from "@/lib/storage/supabase-storage";
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "pikol-uploads");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("private Supabase uploads", () => {
  it("round trips bytes through the private bucket with a scoped key", async () => {
    let stored: BodyInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      if (options.method === "POST") { stored = options.body; return new Response(JSON.stringify({ Key: "saved" })); }
      return new Response(stored, { headers: { "Content-Type": "image/png" } });
    }));
    const storage = new SupabaseStorage("payment-proofs");
    const { key } = await storage.save({ bytes: Buffer.from("proof-image"), contentType: "image/png" });
    expect(key).toMatch(/^payment-proofs\/[0-9a-f-]+\.png$/);
    const result = await storage.getBytes(key);
    expect(result.bytes.toString()).toBe("proof-image");
    expect(result.contentType).toBe("image/png");
  });
  it("rejects traversal and crossing media/proof namespaces", async () => {
    const storage = new SupabaseStorage("payment-proofs");
    for (const key of ["../secret", "venue-media/photo.png", "payment-proofs/../photo.png", "payment-proofs/nested/photo.png"]) {
      await expect(storage.getBytes(key)).rejects.toMatchObject({ httpStatus: 400 });
    }
  });
  it("rejects oversized images and unsupported types before upload", async () => {
    const storage = new SupabaseStorage("venue-media");
    await expect(storage.save({ bytes: Buffer.alloc(5*1024*1024+1), contentType: "image/png" })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(storage.save({ bytes: Buffer.from("svg"), contentType: "image/svg+xml" })).rejects.toMatchObject({ httpStatus: 400 });
  });
  it("reports failed uploads instead of returning a usable file key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 })));
    await expect(new SupabaseStorage("venue-media").save({ bytes: Buffer.from("image"), contentType: "image/png" })).rejects.toMatchObject({ httpStatus: 503 });
  });
  it("requires a private server key", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(new SupabaseStorage("venue-media").save({ bytes: Buffer.from("image"), contentType: "image/png" })).rejects.toMatchObject({ httpStatus: 503 });
  });
});
