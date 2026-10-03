import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { ALLOWED_PROOF_TYPES, MAX_PROOF_BYTES, type PaymentProofStorage } from "./proof-storage";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Private objects are streamed only after Pikol's route-level authorization. */
export class SupabaseStorage implements PaymentProofStorage {
  constructor(private readonly subdir: "payment-proofs" | "venue-media") {}
  private bucket() { return createSupabaseAdminClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET || "pikol-uploads"); }

  async save({ bytes, contentType }: { bytes: Buffer; contentType: string }) {
    if (!(ALLOWED_PROOF_TYPES as readonly string[]).includes(contentType)) throw new ValidationError("Unsupported image type. Use JPG, PNG, or WebP.");
    if (bytes.byteLength > MAX_PROOF_BYTES) throw new ValidationError("Image is too large (max 4 MB).");
    const key = `${this.subdir}/${randomUUID()}.${extensions[contentType]}`;
    const { error } = await this.bucket().upload(key, bytes, { contentType, upsert: false });
    if (error) throw new AppError("We couldn't save this image. Please try again.", 503, "storage_unavailable");
    return { key };
  }

  async getBytes(key: string) {
    const suffix = key.slice(this.subdir.length + 1);
    if (!key.startsWith(`${this.subdir}/`) || !/^[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i.test(suffix)) throw new ValidationError("Invalid file key");
    const { data, error } = await this.bucket().download(key);
    if (error || !data) {
      if (error && "statusCode" in error && String(error.statusCode) === "404") throw new NotFoundError("Image not found");
      throw new AppError("We couldn't load this image. Please try again.", 503, "storage_unavailable");
    }
    return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }
}
