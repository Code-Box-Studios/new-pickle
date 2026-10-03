import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "@/lib/booking/errors";
import {
  ALLOWED_PROOF_TYPES,
  MAX_PROOF_BYTES,
  type PaymentProofStorage,
  type SavedProof,
} from "./proof-storage";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ROOT = path.join(process.cwd(), "uploads");

/** Local-disk implementation, scoped to a subdirectory under `uploads/`. */
export class LocalFsStorage implements PaymentProofStorage {
  constructor(private readonly subdir: string = "payment-proofs") {}

  async save({
    bytes,
    contentType,
  }: {
    bytes: Buffer;
    contentType: string;
  }): Promise<SavedProof> {
    if (!(ALLOWED_PROOF_TYPES as readonly string[]).includes(contentType)) {
      throw new ValidationError("Unsupported image type. Use JPG, PNG, or WebP.");
    }
    if (bytes.byteLength > MAX_PROOF_BYTES) {
      throw new ValidationError("Image is too large (max 4 MB).");
    }
    const name = `${randomUUID()}.${EXT_BY_TYPE[contentType]}`;
    const key = `${this.subdir}/${name}`;
    const abs = path.join(ROOT, this.subdir, name);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    return { key };
  }

  async getBytes(key: string): Promise<{ bytes: Buffer; contentType: string }> {
    // Guard against path traversal: the resolved path must stay under ROOT/subdir.
    const base = path.join(ROOT, this.subdir);
    const abs = path.resolve(base, path.basename(key));
    if (!abs.startsWith(path.resolve(base))) {
      throw new ValidationError("Invalid file key");
    }
    const bytes = await readFile(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    return { bytes, contentType: TYPE_BY_EXT[ext] ?? "application/octet-stream" };
  }
}
