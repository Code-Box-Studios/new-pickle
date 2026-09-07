import { describe, it, expect } from "vitest";
import { venueMediaStorage } from "@/lib/storage";
import { ValidationError } from "@/lib/booking/errors";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("venueMediaStorage", () => {
  it("stores under venue-media/ and reads back", async () => {
    const { key } = await venueMediaStorage.save({ bytes: PNG, contentType: "image/png" });
    expect(key.startsWith("venue-media/")).toBe(true);
    const got = await venueMediaStorage.getBytes(key);
    expect(got.contentType).toBe("image/png");
    expect(Buffer.compare(got.bytes, PNG)).toBe(0);
  });

  it("rejects unsupported types", async () => {
    await expect(
      venueMediaStorage.save({ bytes: PNG, contentType: "image/gif" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
