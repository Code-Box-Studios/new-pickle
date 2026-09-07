/**
 * Payment-proof storage seam. Local filesystem in dev; a prod implementation
 * (S3/R2/etc.) plugs in via `storage/index.ts` with no caller changes.
 *
 * Proofs are *evidence submitted by the customer*, never financial truth.
 */
export interface SavedProof {
  key: string;
}

export interface PaymentProofStorage {
  save(input: { bytes: Buffer; contentType: string }): Promise<SavedProof>;
  getBytes(key: string): Promise<{ bytes: Buffer; contentType: string }>;
}

export const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB
