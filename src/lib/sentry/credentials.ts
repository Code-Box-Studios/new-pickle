import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ValidationError } from "@/lib/booking/errors";

// AES-256-GCM. The 32-byte key is derived from SENTRY_CRED_SECRET (development fallback). Server-only; ciphertext is stored in
// SentryConnection.encryptedApiKey and never sent to the browser.
function key(): Buffer {
  const secret = process.env.SENTRY_CRED_SECRET ?? "dev-sentry-secret-change-in-production";
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new ValidationError("Invalid credential payload");
  try {
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new ValidationError("Could not decrypt credential");
  }
}

export const credentialCipher = { encrypt, decrypt };
