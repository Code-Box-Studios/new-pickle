import { describe, it, expect } from "vitest";
import { LocalFsStorage } from "@/lib/storage/local-fs-storage";
import { ValidationError } from "@/lib/booking/errors";

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("LocalFsStorage", () => {
  const storage = new LocalFsStorage();

  it("saves and reads back a proof with its content type", async () => {
    const { key } = await storage.save({ bytes: PNG, contentType: "image/png" });
    expect(key.startsWith("payment-proofs/")).toBe(true);
    const got = await storage.getBytes(key);
    expect(got.contentType).toBe("image/png");
    expect(Buffer.compare(got.bytes, PNG)).toBe(0);
  });

  it("rejects unsupported content types", async () => {
    await expect(
      storage.save({ bytes: PNG, contentType: "application/pdf" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects files over the size limit", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
    await expect(
      storage.save({ bytes: big, contentType: "image/png" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
