/**
 * Payment-proof storage seam. Supabase private storage by default; explicit
 * local filesystem storage is available for development and tests.
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
